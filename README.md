# Alexa YouTube Player

This is an Alexa Skill which plays audio from YouTube, designed for music.

## Example Usage

Pick from search results:

> *Alexa, ask YouTube Player to look for Guns And Roses Estranged*
> Alexa: *Found 9:51 video called "Guns N' Roses - Estranged". Say "okay", "next result" or "nevermind"*
> *Okay*
> Alexa: [plays the audio]

Just play the song

> *Alexa, ask YouTube Player to play Guns And Roses Estranged*
> Alexa: *Playing 9:51 video called "Guns N' Roses - Estranged".* [plays the audio]

## TODO

* Audio starts playing and then cuts off after ~5 seconds. No errors reported in CloudWatch, just a `PlaybackStarted` event and then the audio stops. I've tried ending session or not, giving a unique token to `AudioPlayer`, neither of those changed this behavior.
* Implement the conversation flow described in "example usage".
