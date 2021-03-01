/**
 * Created by Steve Kreitzer on 03/01/2021
 */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const rmfr = require('rmfr');
const debug = require('debug')('UnicornTranscoder:Streamer');
const rp = require('request-promise-native');
const SessionManager = require('./session-manager');
const PlexDirectories = require('../utils/plex-directories');
const config = require('../config');

class Streamer {
    constructor(sessionId, args, env) {
        this.ffmpeg = null;
        this.session = sessionId.replace('/', '-');
        this.path = path.resolve(config.transcoder.temp_folder + this.session) + '/';

        this.transcoderArgs = args.map((arg) => {
            // Hack to replace aac_lc by aac because FFMPEG don't recognise the codec aac_lc
            if (arg === 'aac_lc')
                return 'aac';
            return arg
                .replace('{STREAM_PATH}', this.path)
                .replace('{INTERNAL_TRANSCODER}', "http://127.0.0.1:" + config.port + '/')
                .replace('{INTERNAL_RESOURCES}', PlexDirectories.getPlexResources())
        });

        if (config.transcoder.debug) {
            this.transcoderArgs.splice(this.transcoderArgs.indexOf('-loglevel'), 2); // Enable logs
            debug(this.transcoderArgs)
        }

        this.transcoderEnv = Object.create(process.env);
        this.transcoderEnv.LD_LIBRARY_PATH = PlexDirectories.getPlexLibraryFolder();
        this.transcoderEnv.FFMPEG_EXTERNAL_LIBS = PlexDirectories.getCodecFolder();
        this.transcoderEnv.LIBVA_DRIVERS_PATH = PlexDirectories.getDriPath();
        this.transcoderEnv.XDG_CACHE_HOME = PlexDirectories.getTemp();
        this.transcoderEnv.XDG_DATA_HOME = PlexDirectories.getPlexResources();
        this.transcoderEnv.EAE_ROOT = PlexDirectories.getTemp();
        this.transcoderEnv.X_PLEX_TOKEN = env.X_PLEX_TOKEN;

        rmfr(this.path)
            .then(() => {
                fs.mkdir(this.path, (err) => {
                    if (err) {
                        debug(`Failed to create directory ${this.path}`);
                        SessionManager.stopStream(this.session);
                    } else {
                        this.startFFMPEG();
                    }
                });
            })
            .catch(() => {});
    }

    startFFMPEG() {
        debug('Spawn ' + this.session);
        SessionManager.saveStream(this.session, this);
        this.ffmpeg = child_process.spawn(
            PlexDirectories.getPlexTranscoderPath(),
            this.transcoderArgs,
            {
                env: this.transcoderEnv,
                cwd: this.path
            });
        this.ffmpeg.on("exit", (code, sig) => {
            this.transcoding = false;
            // TODO Handle code
            this.done();
        });

        if (config.transcoder.debug) {
            this.ffmpeg.stdout.on('data', (data) => { debug('FFMPEG(stdout): ' + data.toString()); }); // Send logs to stdout
            this.ffmpeg.stderr.on('data', (data) => { debug('FFMPEG(stderr): ' + data.toString()); }); // Send logs to stderr
        }
    }

    done() {
        debug('Stream done ' + this.session);
        rp(`${config.loadbalancer_address}/api/stream/${this.session}`, {
            method: 'PATCH',
            body: { status: 'streamed' },
            json: true
        })
            .then(() => {
                debug('LoadBalancer notified')
            })
            .catch(() => {
                debug('LoadBalancer notification failed')
            })
    }

    clean() {
        rmfr(this.path)
            .then(() => {
                debug(`${this.session} cleaned`)
            })
    }

    static start(req, res) {
        debug(`Starting streaming session ${req.body.session}`);
        const session = new Streamer(req.body.session, req.body.args, req.body.env);
        res.json({ status: 'ok' })
    }

    static stop(req, res) {
        if (SessionManager.stopStream(req.params.session))
            res.json({ status: 'ok' });
        else
            res.status(404).json({ error: 'Session not found' });
    }
}

module.exports = Streamer;