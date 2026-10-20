# Call Assistant — Architecture (zero-cost plan)

Status: **proposal, nothing built yet.** Items marked *verified* were checked against official
documentation on 2026-10-20. Items marked *untested* haven't been run on a real Windows PC or Mac
yet. The first build step (§8) exists to test them.

**Requirement (from you): no additional fees.** No paid APIs, no subscriptions, no hosting,
no signing certificates. Everything below costs $0. The trade-offs are listed honestly in §7.

---

## 1. What I found in the environment

| Item | Finding | What it means |
|---|---|---|
| This repository | A Next.js **web app** (Claims Navigator) deployed on Render. | The call assistant has to be a **separate desktop app**, because a website can't capture other apps' audio. It will live in `call-assistant/` with its own `package.json`. The website isn't touched. |
| Development machine | A cloud **Linux** container (Node 22, Python 3.13, Rust, ffmpeg). No Mac, no Windows, no audio devices. | I can build the app and test transcription and the interface using recorded call files. **Live capture has to be tested on a real Windows PC and Mac** (§8). |
| Current versions | Electron 44.9, electron-builder 26.x | Recent enough for the macOS audio API described below. |

## 2. Desktop framework: Electron + TypeScript (free, open source)

Electron has system-audio capture **built in on both Windows and macOS** through one JavaScript
call (*verified*: Electron docs). Tauri would need separate native audio code for each OS. One
codebase means teammates on Windows and Mac get the same app.

## 3. Audio capture (free, no drivers on modern systems)

Two separate streams give reliable speaker labels without AI guessing:

```
 Your microphone ─────────────► "Me"
 Computer output (loopback) ──► "Other Party"
```

**Use a headset.** With laptop speakers the mic also picks up the other party.

| Platform | Method | Permission the user grants once |
|---|---|---|
| Windows 10/11 | WASAPI loopback, built into Electron. **No driver.** Captures the default output device. | Microphone (Settings → Privacy → Microphone → allow desktop apps) |
| macOS 14.2+ | Apple Core Audio Tap API, built into Electron 39+ (*verified*) | "System Audio Recording Only" + Microphone |
| macOS 13–14.1 | Older ScreenCaptureKit path (*untested*) | Screen & System Audio Recording + Microphone |
| macOS 12 and older | Free **BlackHole** virtual audio driver | Microphone |

Known gotchas the app handles:
- If macOS permission is missing, capture **silently returns nothing** (*verified*). The app checks
  the audio level after Start and shows "No call audio detected — check permission" instead of
  transcribing silence.
- Windows loopback captures *all* PC sound (notifications, music), so the app reminds users to mute them.
- Windows and Mac capture code sit behind one `AudioCaptureSource` interface, so a change to one
  can't break the other.

## 4. Transcription: Whisper running **on each computer** (free, private)

* Uses **whisper.cpp**, an open-source, free speech-to-text engine. It runs offline inside the app,
  so **call audio never leaves the computer.**
* The speech model (about 150–500 MB) downloads once during first-run setup. The app picks the model
  size based on how fast the computer is.
* **Near-live, not instant:** text appears in chunks every ~5–10 seconds while you talk.
* The insurance vocabulary (carrier names, ITEL, RCV, ACV, appraisal, umpire…) is given to Whisper as
  a hint list to improve spelling.
* Silent stretches are skipped. This saves CPU and stops Whisper from inventing text during silence, a known Whisper problem.

Speed expectations (*untested on your team's machines*):
- **Apple Silicon Macs (M1 and newer):** comfortably fast.
- **Recent Windows laptops:** fine with the smaller model.
- **Older or low-end Windows laptops:** the text may lag behind the call. If that happens, the
  app finishes transcribing in the minute after you press Stop. Nothing is lost.

Not used: free tiers of cloud transcription APIs. They're rate-limited, can change at any time,
and would send claim audio to a third party.

## 5. Summary: free, two options, user picks in Settings

### Option A (default): "Copy to Claude", using the Claude access you already have

1. After the call you review and correct the transcript in the app.
2. You click **Copy for Claude**. The app copies the transcript **plus** a built-in instruction
   block (your exact summary template, the insurance terminology rules, "Not mentioned" /
   "Needs verification", who-said-what, never invent amounts).
3. You paste it into Claude (claude.ai or the Claude desktop app) and copy back the result.
4. You paste the result into the app's editable **Documentation Note** box. The app checks every dollar
   amount, date and claim number against the transcript and **flags anything that isn't in it**.
   Then you click Copy Documentation Note.

Cost: $0 beyond the Claude access you already have. Quality: the best available. Extra effort: two pastes per call.

### Option B: fully automatic, offline (Ollama)

* **Ollama** (free) runs an AI model on the computer. The app sends the transcript to it and
  fills in the summary automatically. **Nothing leaves the computer.**
* Requires installing Ollama once and a 4–5 GB model download.
* Works well on Apple Silicon Macs with 16 GB+ memory. **Slow on most Windows laptops** without a good graphics card.
* Local models are **noticeably less accurate** than Claude. They're more likely to mix up who said
  what or miss a commitment, so review matters even more.

### Built-in (free, always on): local fact extraction

Before any AI step, the app itself pulls out claim numbers, dollar amounts, dates, and policy and
deductible mentions with simple pattern matching. These fill in the **Important Dates and
Amounts** section and are used for the fact-check above.

## 6. Data and privacy

| Data | Where it goes |
|---|---|
| Call audio | **Stays on the computer.** Transcribed locally, never saved. |
| Transcript | Stays on the computer. It only leaves if *you* paste it into Claude (Option A). |
| Contractor Cloud / teammates / company | **Never automatic.** You copy and paste. |
| Call history | Off by default. If on, saved **encrypted** (OS keychain) in your user folder, with Delete. |
| Logs | Events only (e.g. "capture started"), never transcript text. |

There are no API keys or accounts to manage, so there's nothing to leak.

## 7. Free distribution and what "unsigned" means

* **Builds:** GitHub Actions makes the Windows `.exe` and Mac `.dmg`. It's free within your GitHub
  plan's monthly minutes (a build uses roughly 100–150 of them).
* **Sharing:** upload the two installer files to a **shared Google Drive folder**. Teammates
  download and double-click. They don't need Python, Node or a GitHub account.
* **Updates:** the app shows "New version available" with a link to the Drive folder. Updates
  aren't automatic, because automatic updates on Mac require paid signing.

**No code signing** (it costs $99/yr Apple, ~$120/yr Windows). The one-time consequences:

| Platform | What users see the first time | Ongoing |
|---|---|---|
| Windows | "Windows protected your PC" → **More info → Run anyway** | Nothing further |
| macOS | "App can't be opened" → System Settings → Privacy & Security → **Open Anyway** | After **each update**, macOS may ask again for audio/microphone permission. Re-granting takes ~30 seconds. |

The install guide will include screenshots of these steps. Signing can be added later if the
company ever wants to, with no code changes.

**Total cost: $0.**

## 8. Build plan

1. **Capture test app:** Start/Stop plus two sound meters (Me / Other Party). One teammate on
   Windows and one on a Mac play a real call and confirm the meters move. This settles every
   *untested* capture item.
2. **MVP:**
   - Live local transcription and transcript review/edit
   - "Copy for Claude" plus the editable documentation note with fact-check
   - Copy buttons and Clear Session
   - Consent reminder at Start, recording indicator, Pause/Resume, silent-audio detector
3. **Accuracy:** vocabulary hints, uncertain-word highlighting, speaker renaming, prompt tuning on
   real (approved) calls.
4. **Privacy & reliability:**
   - Optional encrypted history with delete
   - Device-change recovery
   - First-run setup wizard (model download and permission checks)
   - Optional Ollama mode
5. **Packaging:** installers via GitHub Actions, install guide with screenshots, troubleshooting page.

### What I can and can't verify

| Can verify here (Linux) | Needs a real Windows PC / Mac |
|---|---|
| Interface, editing, copy buttons, fact-check, encrypted storage, log scrubbing | Live system-audio capture and permission prompts |
| Local Whisper transcription using recorded test calls | Transcription speed on teammates' actual laptops |
| Installer **builds** (via CI) | Installing on a clean machine; Run anyway / Open Anyway steps |
