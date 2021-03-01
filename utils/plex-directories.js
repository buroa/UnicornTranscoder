const compareVersions = require('compare-versions');
const path = require('path');
const config = require('../config');

class PlexDirectories {
    static getCodecFolder() {
        return path.resolve(`${config.transcoder.codecs_folder}/${config.transcoder.codecs_build}-${config.transcoder.plex_arch}`) + '/';
    }

    static getPlexBuildFolder() {
        return path.resolve(`${config.transcoder.plex_resources}/${config.transcoder.plex_build}`) + '/';
    }

    static getPlexFolder() {
        return path.resolve(this.getPlexBuildFolder(), 'usr/lib/plexmediaserver') + '/';
    }

    static getPlexLibraryFolder() {
        if (compareVersions(config.transcoder.plex_build, '1.15') === 1)
            return path.resolve(this.getPlexFolder(), 'lib') + '/';
        else
            return this.getPlexFolder()
    }

    static getPlexTranscoderPath() {
        return path.resolve(this.getPlexFolder(), config.transcoder.plex_transcoder)
    }

    static getPlexResources() {
        return path.resolve(this.getPlexFolder(), 'Resources') + '/';
    }

    static getEAEFolder() {
        return path.resolve(config.transcoder.codecs_folder, `EasyAudioEncoder-${config.transcoder.eae_version}-${config.transcoder.plex_arch}`) + '/';
    }

    static getEAE() {
        return path.resolve(this.getEAEFolder(), 'EasyAudioEncoder', 'EasyAudioEncoder')
    }

    static getTemp() {
        return path.resolve(config.transcoder.temp_folder) + '/';
    }

    static getDriPath() {
        return path.resolve(this.getPlexFolder(), 'lib/dri');
    }
}

module.exports = PlexDirectories;