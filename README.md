# Hand Song

Make music in the browser with your hands and a webcam. MediaPipe tracks your hands and Tone.js makes the sound.

## Run

```sh
npm install     # also copies the MediaPipe runtime and downloads the hand model into public/
npm run dev     # open http://localhost:5173
```

Camera access only works on `localhost` or over HTTPS.

## Play

**Air guitar** (default mode): your left hand holds a chord sign, your right hand strums.

Each chord has its own fixed hand shape, the same in every song. A chart of the signs sits at the bottom of the left half of the screen, with the sign you're holding lit up.

| Sign (thumb, index, middle, ring, pinky) | Chord |
| --- | --- |
| ☝️ index | C |
| ✌️ index + middle | G |
| index + middle + ring | D |
| four fingers, thumb tucked | Em |
| 🤘 index + pinky | Am |
| 🤙 thumb + pinky | F |
| 👍 thumb | A |
| 🖐 open hand | E |
| L shape: thumb + index | Dm |
| thumb + index + middle | Bm |
| ✊ fist | mute the strings |

The most used chords are on shapes without the thumb, because the thumb is the hardest finger for the camera to read. A sign has to hold for 100 ms before it counts, and shapes that aren't a sign keep the last chord, so passing through other shapes on the way doesn't change anything. Switching to another chord stops the old one ringing.

To strum, sweep your right hand down or up across the six strings in the right half of the screen; the middle of your hand is the pick. Down strums play the chord low to high, up strums high to low. A faster sweep strums harder and tighter. Your hand has to get clear of the strings on the other side before the next strum, so a hand resting on the strings doesn't retrigger. Strumming with no sign held (or with a fist) gives a muted scratch. Move your left hand toward the screen edge for a brighter sound.

**Count fingers**

| Hand | Hold up 1–5 fingers | Fist | Up / down | Toward the screen edge |
| --- | --- | --- | --- | --- |
| Right (right half of the screen) | play the 1st–5th note of the scale | rest | change octave (low / mid / high) | brighter lead |
| Left (left half of the screen) | play one of five chords | stop | – | brighter pad |

With the pentatonic scales, the five fingers cover every note. With 7-note scales they play notes 1 to 5, the piano "five-finger position".

**Pinch & slide**: move your hand up or down to choose a note or chord, and pinch your thumb and index finger to play it. Keep pinching while you move to glide between notes.

Pick the mode under **Mode** in the toolbar. The toolbar also sets the key, scale, lead sound, chord sound (warm pad, electric piano, organ, strings, glassy bell, acoustic guitar, lo-fi keys or 8-bit), chord style (pad, strum or arpeggio; not used in Air guitar, where you strum yourself), drum pattern and tempo. On a phone the less used controls sit behind **More**.

**Styles** set the lead, chord sound, chord style, beat, tempo, reverb and delay in one go. *Original* is the default sound. After picking a style you can still change any single control.

## Songs

Pick a song under **Song** in the toolbar. The key, scale and tempo switch to the song.

In Air guitar mode every chord of the song is played with its sign. To make that work for any song, its chords are simplified to plain triads (Em7 → Em, Cadd9 → C, Dsus4 → D, A7sus4 → A; dim plays as minor, aug as major) and, if some chord still has no sign, the whole song is transposed by the smallest step that gives every chord one (Shape of You, for example, moves down 2 semitones to Bm Em G A). The panel says when a song was moved. A song that can't be fitted is greyed out in the list in this mode.

In Count fingers mode the song is played as written: finger 1 plays the first chord of the song, finger 2 the second and so on. In Pinch & slide mode each chord gets its own row. The right hand plays the melody in the song's key.

The panel under the toolbar shows the chord to play now, its sign (or finger count, or row), and the next few chords. Play the right chord to fill the bar: each chord lasts its number of beats at the current tempo, then the song moves on. In Air guitar mode the bar only fills once you've strummed the chord at least once, so holding the shape alone isn't enough. Playing another chord or nothing pauses the bar without resetting it, so you can take your time. **Skip** moves on one chord, **Restart** goes back to the start. Lowering the BPM gives you more time per chord. Changing Mode during a song keeps your place in it and switches between the fitted and the written chords (and their keys).

Lyrics appear only for the public-domain songs (Happy Birthday, Twinkle Twinkle Little Star, Amazing Grace). The other songs show chords only, so sing along from memory. Changing Key or Scale during a song only moves the melody hand; the song's chords stay the same. Pick **Free play** to go back to the normal chords.

Press <kbd>Space</kbd> to turn the beat on or off and <kbd>R</kbd> to start or stop recording. Each recording can be downloaded as an audio file.

If finger counts or signs misread with your camera, adjust `FINGER_EXTENDED` and `THUMB_EXTENDED` at the top of `src/hands.ts`.

## Code

- `src/hands.ts`: sets up MediaPipe, maps landmarks to the screen, and handles smoothing, pinch detection, finger counting and hand speed
- `src/music.ts`: scales, melody notes and chords
- `src/songs.ts`: the song library (chord progressions, sections, public-domain lyrics)
- `src/signs.ts`: the air guitar chord signs, and fitting songs onto them
- `src/audio.ts`: synths, chord sounds, air guitar strums, styles, effects, drum machine and recorder
- `src/main.ts`: toolbar, zone logic, air guitar signs and strumming, song progress, drawing and the main loop
