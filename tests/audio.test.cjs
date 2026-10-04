const test = require('node:test');
const assert = require('node:assert/strict');
const { load, store, get } = require('./helpers.cjs');

test('PCM clipping never wraps positive samples into negative int16 values', () => {
	const { ctx } = load('src/lib/recorder.ts', ['convertChannelData']);
	assert.equal(new Int16Array([ctx.convertChannelData(1.2)])[0], 32767);
	assert.equal(new Int16Array([ctx.convertChannelData(-1.2)])[0], -32768);
});
function player(extra = {}) {
	let success = 0,
		stops = 0,
		failure = 0;
	const { ctx } = load(
		'src/components/Player.svelte',
		['onCurrentTimeChange', 'resetRecorderContext', 'cancelRecording'],
		{
			$exportCancelController$: undefined,
			$currentTime$: 10,
			$currentAudioLoaded$: true,
			$paused$: false,
			$exportAudioBitrate$: 128,
			originalCurrentTime: -1,
			originalPlaybackRate: -1,
			originalMuted: undefined,
			removeRecordingAbortListener: undefined,
			skipNextCue: false,
			actionTimeIndex: 0,
			actionEndTimes: [10],
			actionStartTimes: [8],
			isLoopAction: false,
			audioElement: { ended: true },
			recorderSuccess: () => {
				success++;
			},
			recorderFailure: () => {
				failure++;
			},
			stopRecording: async () => {
				stops++;
				return new ArrayBuffer(1);
			},
			setTime: (value) => {
				ctx.$currentTime$ = value;
			},
			AbortError: class extends Error {},
			...extra,
		},
	);
	return { ctx, success: () => success, stops: () => stops, failure: () => failure };
}
test('recording resolves at the exact audio duration', async () => {
	const p = player();
	await p.ctx.onCurrentTimeChange();
	assert.equal(p.success(), 1);
	assert.equal(p.stops(), 1);
	assert.equal(p.ctx.actionTimeIndex, -1);
});
test('recording also resolves when a subtitle extends beyond the file', async () => {
	const p = player({ actionEndTimes: [12] });
	await p.ctx.onCurrentTimeChange();
	assert.equal(p.success(), 1);
});
test('loop restarts playback after the media has ended', async () => {
	const p = player({ isLoopAction: true, $paused$: true });
	await p.ctx.onCurrentTimeChange();
	assert.equal(p.ctx.$currentTime$, 8);
	assert.equal(p.ctx.$paused$, false);
	assert.equal(p.stops(), 0);
});
test('recording failure is reported once without calling a cleared success callback', async () => {
	const p = player({
		stopRecording: async () => {
			throw new Error('decode failed');
		},
	});
	await p.ctx.onCurrentTimeChange();
	assert.equal(p.failure(), 1);
	assert.equal(p.success(), 0);
});
test('canceling a paused recording does not depend on another timeupdate', async () => {
	const p = player({ $paused$: true });
	await p.ctx.cancelRecording();
	assert.equal(p.failure(), 1);
	assert.equal(p.stops(), 1);
	assert.equal(p.ctx.actionTimeIndex, -1);
});
test('recorder closes decoding contexts, handles mono and clears canceled audio', async () => {
	let opened = 0,
		closed = 0,
		stoppedTracks = 0,
		decodes = 0;
	class Context {
		constructor() {
			opened++;
			this.destination = {};
		}
		createMediaElementSource() {
			return { connect() {} };
		}
		createMediaStreamDestination() {
			return {
				stream: {
					getTracks: () => [
						{
							stop() {
								stoppedTracks++;
							},
						},
					],
				},
			};
		}
		async resume() {}
		async close() {
			closed++;
		}
		async decodeAudioData() {
			decodes++;
			return {
				numberOfChannels: 1,
				sampleRate: 44100,
				getChannelData(channel) {
					assert.equal(channel, 0);
					return new Float32Array([1.2, -1.2]);
				},
			};
		}
	}
	class Recorder extends EventTarget {
		mimeType = 'audio/wav';
		state = 'inactive';
		start() {
			this.state = 'recording';
		}
		stop() {
			this.state = 'inactive';
			queueMicrotask(() => {
				const event = new Event('dataavailable');
				event.data = new Blob(['wav']);
				this.dispatchEvent(event);
				this.dispatchEvent(new Event('stop'));
			});
		}
	}
	const { ctx } = load('src/lib/recorder.ts', null, {
		AudioContext: Context,
		Recorder,
		connect: async () => {},
		register: async () => {},
		throwIfAborted: (signal) => signal?.throwIfAborted(),
		lamejs: {
			Mp3Encoder: class {
				encodeBuffer() {
					return new Uint8Array([1]);
				}
				flush() {
					return new Uint8Array([2]);
				}
			},
		},
	});
	const audio = {};
	await ctx.startRecording(audio);
	await ctx.stopRecording(128, true);
	await ctx.startRecording(audio);
	const output = await ctx.stopRecording(128);
	assert.ok(output.byteLength > 0);
	assert.equal(decodes, 1);
	assert.equal(opened, 2);
	assert.equal(closed, 1);
	ctx.releaseRecordingAudio(audio);
	assert.equal(closed, 2);
	assert.equal(stoppedTracks, 1);
});
function ffmpeg(extra = {}) {
	return load('src/lib/ffmpeg.ts', null, {
		FFmpeg: class {
			loaded = false;
			async load() {
				throw new Error('unavailable');
			}
		},
		ffmpegWorker: 'worker.js',
		window: { GM_info: { scriptHandler: 'Tampermonkey' }, GM_getResourceURL: (name) => name },
		get,
		settings$: { exportAudioProcessor$: store('ffmpeg') },
		AudioProcessor: { RECORDER: 'recorder' },
		toTimeString: String,
		...extra,
	});
}
test('chapter titles preserve colons', () => {
	const f = ffmpeg();
	f.ctx.handleFFMPEGLogForChapterData({ message: 'Chapter #0:0: start 0.000, end 10.000' });
	f.ctx.handleFFMPEGLogForChapterData({ message: '    title           : Chapter 1: The Beginning' });
	assert.equal(f.run('parsedChapters[0].label'), 'Chapter 1: The Beginning');
});
test('WASM download is cached from the response instead of fetched twice', async () => {
	let fetches = 0,
		puts = 0;
	const f = ffmpeg({
		fetch: async () => {
			fetches++;
			return new Response('wasm');
		},
		caches: {
			open: async () => ({
				keys: async () => [],
				put: async (_, response) => {
					puts++;
					assert.equal(await response.text(), 'wasm');
				},
			}),
		},
	});
	const url = await f.ctx.toBlobURL('ffmpeg-core.wasm', 'https://example.com/core.wasm', 'application/wasm');
	URL.revokeObjectURL(url);
	assert.equal(fetches, 1);
	assert.equal(puts, 1);
});
test('failed FFmpeg initialization does not persist a different backend', async () => {
	const f = ffmpeg({
		fetch: async () => new Response('resource'),
		caches: { open: async () => ({ keys: async () => [], put: async () => {} }) },
	});
	await assert.rejects(f.ctx.initializeFFMPEG(), /Retry or select the Recorder/);
	assert.equal(f.ctx.settings$.exportAudioProcessor$.value, 'ffmpeg');
});

test('failed FFmpeg conversion cannot reuse a previous export file', async () => {
  let reads = 0;
  const f = ffmpeg({
    FFmpeg: class { loaded=true; async exec(){return 1;} async readFile(){reads++;return new Uint8Array([1]);} },
    settings$: {enableFFMPEGLog$:store(false)}, AudioFormat:{OPUS:'opus'}, throwIfAborted:()=>{}
  });
  await assert.rejects(f.ctx.getAudio({name:'audio.mp3'},[{startSeconds:1,endSeconds:2}],false), /exited with code 1/);
  assert.equal(reads,0);
});
