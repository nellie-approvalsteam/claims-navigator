# Call Assistant — Phase 1: Assessment & Architecture

Status: **proposal, nothing built yet.** Everything below marked *verified* was checked
against official documentation on 2026-10-20. Anything marked *untested* has not been run on a
real Windows or Mac machine yet. The first build step (below) exists to test those items.

---

## 1. What I found in the environment

| Item | Finding | What it means |
|---|---|---|
| This repository | A Next.js **web app** (Claims Navigator) deployed on Render, with team login and a Contractors Cloud API client. It doesn't capture any audio and doesn't call an AI model yet. | The call assistant has to be a **separate desktop app**, because a website can't reliably capture other apps' audio. I propose putting it in this repo under `call-assistant/` with its own `package.json` so the team has one place to look. The existing web app isn't touched. |
| Development machine | A cloud **Linux** container with Node 22, Python 3.13, Rust and ffmpeg. There's no Mac, no Windows, no speakers, no microphone. | I can write the app, unit-test it, run the interface and test the transcribe → summarize pipeline using recorded audio files. **I can't test live system-audio capture on either OS from here.** A teammate has to run a small test build on one Mac and one Windows PC (see §8). |
| Current versions | Electron 44.9 (stable), electron-builder 26.x | These are recent enough to include the macOS audio API described below. |

## 2. The key decision: Electron vs. Tauri

**Recommendation: Electron + TypeScript.**

| | Electron | Tauri |
|---|---|---|
| System audio on **Windows** | Built in. Chromium's capture API with `audio: 'loopback'` uses WASAPI loopback. No driver needed. | Not built in. The webview (WebView2) doesn't expose loopback, so we'd write Rust audio code ourselves. |
| System audio on **macOS** | Built in (*verified*: Electron docs). On macOS 14.2+, Electron 39+ uses Apple's **Core Audio Tap API** through the same JavaScript call. | Not built in. Safari's webview can't capture system audio, so we'd write native ScreenCaptureKit or Core Audio code ourselves. |
| One codebase for both OSes | Yes. The *same* JavaScript call works on both; only setup and permissions differ. | Two native audio implementations to maintain. |
| Installer size | ~100–150 MB | ~10–20 MB |
| Maintainability for a non-developer | TypeScript only | TypeScript + Rust + OS-specific native code |

Tauri's smaller download isn't worth maintaining two native audio stacks. Electron is what most
cross-platform meeting-notes tools use for exactly this reason.

## 3. How audio capture will work

### The design trick: two separate streams = reliable "Me" vs "Other Party"

Speaker separation done by AI ("diarization") is often wrong on phone audio. We avoid relying on it:

```
 Your microphone ──────────────► stream "Me"           ─┐
                                                        ├─► transcription (labelled by stream)
 Computer output (loopback) ───► stream "Other Party"  ─┘
```

* The other party's voice only comes out of your speakers/headset, so the **loopback** stream is
  "Other Party". This meets the "don't rely on the microphone" requirement.
* Your voice comes in through your **microphone**, so that stream is "Me".
* If there are several other people on the call (adjuster + appraiser), AI diarization is used
  *within* the Other Party stream only ("Other Party 1 / 2"). You can rename them afterwards.

**Limitation: use a headset.** If you use laptop speakers, your mic also picks up the other party,
which creates duplicate lines labelled "Me". Chromium's echo cancellation should reduce this
(*untested*). The app will recommend headphones on first run.

### Windows (10 and 11)

* Uses **WASAPI loopback** via Electron. **No virtual audio driver needed.**
* Captures everything the PC is playing: Teams, Zoom, RingCentral, Dialpad, browser calls, softphones.
  It also captures notification sounds and music, so the app should tell users to mute other audio.
* Picking a specific output device: loopback captures the **default output device**. If a user's
  calls play through a non-default headset, they set that headset as the default in Windows sound
  settings. The app will detect silence and show this tip. Per-device capture would need native
  code, so that's deferred until someone actually needs it.
* Microphone permission: Windows Settings → Privacy → Microphone → "Let desktop apps access your
  microphone" must be on.

### macOS

| macOS version | How it works | Permission the user grants |
|---|---|---|
| **14.2 Sonoma and newer** (recommended) | Core Audio Tap API, used automatically by Electron 39+ (*verified*, Electron docs) | "System Audio Recording Only" (System Settings → Privacy & Security → Screen & System Audio Recording), plus Microphone |
| 13 Ventura – 14.1 | Older ScreenCaptureKit path in Chromium (*untested*, may need extra flags) | "Screen & System Audio Recording" + Microphone |
| 12 Monterey and older | No built-in API. Needs the free **BlackHole** virtual audio driver plus a Multi-Output Device | Microphone |

Gotchas the app must handle (*verified*, Electron docs):

1. The packaged app must declare `NSAudioCaptureUsageDescription` in its Info.plist, or capture silently fails.
2. **If permission is missing or denied, macOS gives the app a silent audio track with no
   error.** So the app will run a **level-meter check** at Start and show a clear message like
   "No call audio detected — check System Audio permission" instead of transcribing silence.
3. Electron still asks for a "screen" source to attach the audio to. Whether macOS shows the
   Screen Recording prompt in addition to System Audio is **untested**. The capture test (§8) checks this.
4. macOS ties permissions to the app's code signature. **Unsigned builds may lose permission after
   every update** (see §7 on signing).

**Fallback if Core Audio Tap misbehaves:** a small open-source helper (a Swift command-line tool
that wraps the Core Audio Tap API) bundled inside the Mac app. It plugs in behind the same audio
interface, so nothing else changes. We'd only build this if the capture test fails.

### Common audio interface (keeps Windows and Mac code apart)

```ts
interface AudioCaptureSource {
  start(onChunk: (pcm16k: Int16Array) => void): Promise<void>;
  pause(): void; resume(): void; stop(): Promise<void>;
  onLevel(cb: (rms: number) => void): void;    // drives the "is audio flowing?" indicator
  onError(cb: (e: CaptureError) => void): void; // device unplugged, permission denied…
}
// Implementations: ElectronLoopbackSource (Win + Mac), MicSource (both),
// VirtualDeviceSource (BlackHole fallback), [later] MacCoreAudioTapHelperSource
```

The app detects the OS and macOS version at startup and picks an implementation automatically.

## 4. Transcription (speech-to-text)

| Option | Accuracy on phone audio | Live? | Privacy | Cost (approx.) | Setup |
|---|---|---|---|---|---|
| **Deepgram Nova-3 streaming** (recommended) | High. Good at formatting numbers, dates and money. Accepts up to 100 **key terms** (carrier names, "ITEL", "RCV"…) | Yes, < 1 s | Audio sent to Deepgram | ~$0.005–0.008 per minute per stream | API key |
| AssemblyAI Universal-Streaming | High | Yes | Audio sent to AssemblyAI | ~$0.15/hour per stream (cheaper) | API key |
| Local Whisper (whisper.cpp) | Good on Apple Silicon. Slow on older Windows laptops | Near-live in chunks | **Audio never leaves the PC** | Free | Bundles a 0.5–1.5 GB model per user |

**Recommendation:** Deepgram Nova-3 for the MVP because it's the most reliable for live claim numbers and
dollar amounts, and supports key terms and short-lived tokens (§6) (*verified*, Deepgram docs). Swapping
in AssemblyAI is a small change behind the same interface if cost matters more. Local Whisper is a
Phase 3 option for anyone who must keep audio on the machine.

Uncertain words: the transcription service returns a confidence score for each word. Low-confidence
words, **and any number with low confidence**, are highlighted in the transcript and passed to the
summarizer marked as uncertain.

```ts
interface Transcriber {
  connect(streamLabel: 'me' | 'other', keyterms: string[]): Promise<void>;
  send(pcm: Int16Array): void;
  onSegment(cb: (s: TranscriptSegment) => void): void; // text, words+confidence, start/end time
  close(): Promise<void>;                                 // auto-reconnects on network blips
}
```

## 5. Summarization (AI)

* **Claude** through Anthropic's official TypeScript SDK, default model `claude-opus-5-5`. One
  request per call, made **only when you press "Generate Summary"**, after you've reviewed the transcript.
* The output comes back as **structured JSON matching your template** (Call Summary, Person Contacted,
  Claim Information, Key Discussion Points, Status/Outcome, Commitments, Dates & Amounts, Documentation
  Note), so every heading is always present.
* Guardrails in the instructions: every claim fact is tagged by **who said it** (Me / Other Party /
  agreed). Disputed carrier positions are labelled as positions, not facts. Missing fields =
  "Not mentioned". Low-confidence items = "Needs verification". No inventing amounts or dates.
* A programmatic check after the AI responds: every dollar amount, date and claim number in the
  summary must actually appear in the transcript. Any that don't are flagged "Needs verification".
* The insurance terminology list and note template are plain JSON files (like `/content` in
  Claims Navigator), so they can be edited without changing code and later served centrally.

## 6. Keys, data flow, and team setup

### What leaves the computer

| Data | Goes to | When |
|---|---|---|
| Live call audio (both streams) | Transcription vendor (Deepgram) | Only while "Listening" is on |
| Transcript text | Anthropic (Claude) | Only when you press "Generate Summary" |
| Anything | Contractor Cloud / teammates / company | **Never automatically.** You copy and paste. |
| Raw audio | Nowhere, and not saved locally | — |

Both vendors offer business terms where API data isn't used to train their models. Your company should
confirm their data-processing terms are acceptable for homeowner and claim data before cloud
processing is turned on. **The app won't send anything until cloud processing has been
explicitly turned on in Settings.**

### Team key management — two modes, same app

1. **Personal keys (MVP):** each user pastes their own Deepgram and Anthropic keys into Settings.
   Keys are encrypted with the OS keychain (Electron `safeStorage`: Keychain on Mac, DPAPI on
   Windows). They're never written to logs, source code or the installer.
2. **Company broker (recommended for the team rollout):** add two small endpoints to the
   **Claims Navigator server you already host on Render**:
   * `POST /api/call-assistant/stt-token` returns a **30-second Deepgram token** (*verified*:
     Deepgram's `/auth/grant`), so the company's Deepgram key never leaves the server.
   * `POST /api/call-assistant/summarize` passes the transcript to Claude and returns the summary. It **doesn't store** it.
   * Both use the team login that already exists. **Extra hosting cost: $0** (it's the same server).
     One trade-off: transcript text passes through your Render server in memory.
   * It also gives one place to update the note template and terminology list for everyone (`GET /api/call-assistant/config`).

### Local storage (call history)

* Off by default. When it's on, transcripts and summaries are saved under the app's per-user data folder,
  **encrypted** with the same OS-keychain key. Users can delete one session or all of them. Audio is never saved.
* App logs record events only (e.g. "capture started", "device lost"), never transcript text or keys.

## 7. Packaging, signing, and costs

### Distribution

* **electron-builder** produces a Windows `.exe` installer (NSIS) and a macOS `.dmg` (Apple
  Silicon + Intel). Teammates install nothing else.
* Builds run on **GitHub Actions** (one Windows runner and one macOS runner), because macOS apps must be built on a Mac.
* Updates: `electron-updater` checks GitHub Releases at startup. The version number shows in Settings → About.

### Code signing (strongly recommended before team rollout)

| Platform | Without signing | With signing | Cost |
|---|---|---|---|
| macOS | Users must go to System Settings → Privacy & Security → "Open Anyway". **Audio permission may reset after each update.** | Opens normally; permissions stay | **Apple Developer Program $99/year** (company account) + notarization (free) |
| Windows | SmartScreen "Windows protected your PC" → More info → Run anyway | Clean install | **Azure Artifact Signing (formerly Trusted Signing) ~$9.99/month** for US companies, or an OV certificate (~$200–400/year) |

You can pilot with unsigned builds on 2–3 machines, but sign before giving it to the whole team.

### Running costs (estimates, check vendor pricing pages)

Per **15-minute call** (two streams transcribed + one summary):

| | Deepgram (recommended) | AssemblyAI (cheaper) |
|---|---|---|
| Transcription (2 × 15 min) | ~$0.15–0.23 | ~$0.08 |
| Claude summary (`claude-opus-5-5`, ~6k tokens in, ~3k out incl. reasoning) | ~$0.08 | ~$0.08 |
| **Total per call** | **~$0.23–0.31** | **~$0.16** |

Example: 10 people × 8 calls/day × 22 workdays ≈ 1,760 calls/month ≈ **$280–550/month**. Cost
levers if needed: AssemblyAI, Sonnet 5.5 for summaries (~half the cost), or local Whisper.
Deepgram and Anthropic both bill pay-as-you-go, with no subscription.

## 8. Build plan (smallest working version first)

**Step 1 — Capture test app (first build):** a tiny Electron app with only Start/Stop, two level
meters (Me / Other Party) and a "save 30-second test clip" button. GitHub Actions builds the Windows
`.exe` and Mac `.dmg`. **One teammate on Windows and one on a Mac** play a call through RingCentral,
Teams, Zoom, or a browser call and report whether the meters move. This answers every *untested*
item above before the rest of the app gets built on top of it.

**Step 2 — MVP:** live two-stream transcription → transcript review/edit → Generate Summary →
editable documentation note → Copy buttons → Clear Session. Includes the consent reminder at Start,
a recording indicator, Pause/Resume, and the silent-audio detector.

**Step 3 — Accuracy:** key-term list, uncertain-word highlighting, number/date cross-check,
speaker renaming, a prompt test set built from 5–10 real (approved) call transcripts.

**Step 4 — Privacy & reliability:** encrypted optional history and delete, reconnect on network
drop or device change, log scrubbing check, first-run setup wizard.

**Step 5 — Packaging & rollout:** signing, auto-update, install guide for Windows/Mac,
troubleshooting page, optional Claims Navigator broker endpoints.

### What I can and can't verify

| Can verify here (Linux) | Needs a real Windows PC / Mac |
|---|---|
| UI, transcript editing, copy buttons, settings, encrypted storage, log scrubbing | Live system-audio capture and permission prompts |
| Transcribe + summarize pipeline using recorded test calls | Specific calling apps (RingCentral, Teams, Zoom, browser) |
| Installer **builds** (via CI) | Installing on a clean machine; SmartScreen/Gatekeeper behaviour |
