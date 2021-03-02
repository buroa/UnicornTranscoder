/**
 * Created by drouar_b on 18/08/2017.
 */

const debug = require('debug')('UnicornTranscoder:Dash');
const Transcoder = require('./transcoder');
const SessionManager = require('./session-manager');
const config = require('../config');
const utils = require('../utils/utils');
const PlexDirectories = require('../utils/plex-directories');

class Dash {
    static serve(req, res) {
        let sessionId = null;

        if (typeof req.query !== 'undefined' && typeof req.query.session !== 'undefined')
            sessionId = req.query.session;
        else if (typeof req.body !== 'undefined' && typeof req.body.session !== 'undefined')
            sessionId = req.body.session;
        
        if (typeof sessionId === 'undefined')
            return res.status(400).send('Invalid session id');
        
        debug(sessionId);

        // we do not have a current session for this transcoder
        let transcoder = SessionManager.getSession(sessionId);
        if (typeof transcoder === 'undefined') {
            debug('Starting new transcoder for ' + sessionId);
            SessionManager.saveSession(new Transcoder(sessionId, req, res));
        } else {
            debug('Already serving ' + sessionId);
        }
    }

    static serveInit(req, res) {
        let sessionId = req.params.sessionId;

        let transcoder = SessionManager.getSession(sessionId);
        if (transcoder !== null) {
            SessionManager.updateTimeout(sessionId);
            transcoder.getChunk(0, (chunkId) => {
                // -2 -> getChunk timeout
                // -1 -> Session not alive
                if (chunkId === -2 || chunkId === -1) {
                    if (!res.headersSent)
                        return res.status(404).send('Callback ' + chunkId);
                } else {
                    debug('Serving init-stream' + req.params.streamId + '.m4s for session ' + sessionId);
                    let file = PlexDirectories.getTemp() + sessionId + "/init-stream" + req.params.streamId + ".m4s";
                    res.sendFile(file);
                }
            }, req.params.streamId, true);
        } else {
            SessionManager.restartSession(sessionId, 'DASH', res);
        }
    }

    static serveChunk(req, res) {
        let sessionId = req.params.sessionId;

        let transcoder = SessionManager.getSession(sessionId);
        if (transcoder !== null) {
            SessionManager.updateTimeout(sessionId);
            transcoder.getChunk(parseInt(req.params.partId) + 1, (chunkId) => {
                if (chunkId === -2 || chunkId === -1) {
                    if (!res.headersSent)
                        return res.status(404).send('Callback ' + chunkId);
                } else {
                    let file = PlexDirectories.getTemp() + sessionId + "/chunk-stream" + req.params.streamId + "-" + utils.pad(parseInt(req.params.partId) + 1, 5) + ".m4s";
                    debug('Serving chunk-stream' + req.params.streamId + "-" + utils.pad(parseInt(req.params.partId) + 1, 5) + '.m4s for session ' + sessionId);
                    res.sendFile(file);
                }
            }, req.params.streamId);
        } else {
            SessionManager.restartSession(sessionId, 'DASH', res);
        }
    }
}

module.exports = Dash;
