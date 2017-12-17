"use strict";
const querystring = require("querystring");
const async = require("async");
const needle = require("needle");
const ytdl = require("ytdl-core");

// options: object with
//    text: optional string to be spoken
//    audio_url: optional string, URL of audio file to be played
//    end_session: optional boolean
//    pause: optional boolean, whether to pause playing audio
const generate_alexa_response = (options) => {
  options = options || {};

  const alexa_response = {
    version: "1.0",
    response: {
      directives: []
    }
  };

  if (options.text) {
    alexa_response.response.outputSpeech = {
      type: "PlainText",
      text: options.text
    };
  }

  if (options.end_session) {
    alexa_response.response.shouldEndSession = true;
  }

  if (options.audio_url) {
    alexa_response.response.directives.push(
      {
        type: "AudioPlayer.Play",
        playBehavior: "REPLACE_ALL",
        audioItem: {
          stream: {
            token: options.audio_url,
            url: options.audio_url
          }
        }
      }
    );
  }

  if (options.pause) {
    alexa_response.response.directives.push(
      {
        type: "AudioPlayer.ClearQueue",
        clearBehavior: "CLEAR_ALL"
      }
    );
  }

  return alexa_response;
};

// Look for the best quality MP4/AAC audio-only file.
const find_best_format = (formats) => {
  return formats.reduce(
    (current_best, format) => {
      format = format || {};

      // This format has video: skip.
      if (format.bitrate) {
        return current_best;
      }

      // This format isn't an M4A container with AAC-encoded audio: skip.
      if (!(format.container === "m4a" && format.audioEncoding === "aac")) {
        return current_best;
      }

      // This format doesn't have a better audio bitrate than what we've already seen: skip.
      if (~~format.audioBitrate <= ~~((current_best || {}).audioBitrate)) {
        return current_best;
      }

      return format;
    },
    null
  );
};

const search = (search_terms, callback) => {
  const q = querystring.stringify(
    {
      part: "id",
      maxResults: 3,
      q: search_terms,
      key: process.env.YOUTUBE_API_KEY
    }
  );

  async.waterfall(
    [
      (cb) => {
        needle.get(
          `https://www.googleapis.com/youtube/v3/search?${q}`,
          { parse_response: true },
          (error, response, body) => {
            if (error || ~~(response || {}).statusCode !== 200) {
              console.log(`Failed searching YouTube: ${(response || {}).statusCode}\n${error || body}`);
              return cb({ text: "Sorry, searching YouTube failed. Try again later.", end_session: true });
            }

            const search_results = (body.items || []).map((item) => ((item || {}).id || {}).videoId).filter((x) => x);
            if (search_results.length == 0) {
              return cb({ text: "Sorry, didn't find any results for that search. Try a different search.", end_session: true });
            }

            console.log(`Got search results: ${search_results}`);

            cb(null, search_results);
          }
        );
      },
      (search_results, cb) => {
        ytdl.getInfo(`https://www.youtube.com/watch?v=${search_results[0]}`, cb);
      },
      (video_information, cb) => {
        const best_format = find_best_format(video_information.formats || []);
        if (!best_format) {
          return cb({ text: "Sorry, this video didn't have a compatible audio file available.", end_session: true });
        }

        console.log(`Found a format that we should use: ${JSON.stringify(best_format)}`);
        cb(null, video_information, best_format.url);
      }
    ],
    (error, video_information, audio_url) => {
      if (error) {
        // Note that `error` here will be a response for Alexa to send back.
        return callback(null, error);
      }

      console.log(`Playing ${video_information.video_id}`);
      // video_information.length_seconds
      return callback(null, { text: `Playing ${video_information.title}`, audio_url: audio_url }); // TODO: speak duration before playing
    }
  );
}

const unimplemented_intents = [
  "AMAZON.LoopOffIntent",
  "AMAZON.LoopOnIntent",
  "AMAZON.NextIntent",
  "AMAZON.PreviousIntent",
  "AMAZON.RepeatIntent",
  "AMAZON.ShuffleOffIntent",
  "AMAZON.ShuffleOnIntent",
  "AMAZON.StartOverIntent"
];

exports.handler = (event, context, callback) => {
  console.log(`[handler] Incoming event type ${event.request.type}: ${JSON.stringify(event)}`);

  const cb = (error, result) => {
    if (error) {
      return callback(error);
    }

    console.log(`[handler] responding with ${JSON.stringify(result)}`);
    callback(null, generate_alexa_response(result));
  };

  const intent = (event.request.intent || {}).name;
  if (event.request.type === "LaunchRequest") {
    return cb(null, { text: "Tell me to play something or look for something" });
  } else if (intent === "SearchIntent") {
    const search_terms = (((event.request.intent || {}).slots || {})["SearchTerms"] || {}).value;
    if (!search_terms) {
      return cb(null, { text: "Sorry, I couldn't understand what you said. Please ask again.", end_session: true });
    }

    return search(event.request.intent || {}, cb);
  } else if (intent === "AMAZON.PauseIntent" || intent === "AMAZON.CancelIntent") {
    return cb(null, { text: "Okay", pause: true, end_session: true });
  } else if (intent === "AMAZON.ResumeIntent") {
    // TODO
    return cb(null, { text: "Hold on, not implemented yet", end_session: true });
  } else if (unimplemented_intents.includes(intent)) {
    return cb(null, { text: "Sorry, that functionality hasn't been implemented" });
  } else {
    return cb(null, { end_session: true });
  }
};
