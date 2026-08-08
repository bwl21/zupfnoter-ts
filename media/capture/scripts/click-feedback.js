(() => {
  const styleId = 'zupfnoter-capture-click-feedback-style'

  function installStyle() {
    if (document.getElementById(styleId) !== null) return
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @keyframes zupfnoter-capture-click-ring {
        0% { opacity: 1; transform: translate(-50%, -50%) scale(0.25); }
        55% { opacity: 0.95; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.55); }
      }
      .zupfnoter-capture-click-ring {
        position: fixed;
        z-index: 2147483647;
        width: 58px;
        height: 58px;
        border: 7px solid #ff9f1c;
        border-radius: 50%;
        box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.95), 0 0 22px rgba(255, 159, 28, 0.95);
        pointer-events: none;
        animation: zupfnoter-capture-click-ring 850ms ease-out forwards;
      }
      .zupfnoter-capture-pointer {
        position: fixed;
        z-index: 2147483646;
        width: 30px;
        height: 38px;
        pointer-events: none;
        filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.85));
        transform: translate(2px, 2px);
        opacity: 0;
        transition: opacity 120ms ease;
      }
      .zupfnoter-capture-pointer svg {
        display: block;
        width: 100%;
        height: 100%;
      }
    `
    document.head.append(style)
  }

  function showRing(x, y) {
    installStyle()
    const ring = document.createElement('span')
    ring.className = 'zupfnoter-capture-click-ring'
    ring.style.left = `${x}px`
    ring.style.top = `${y}px`
    document.body.append(ring)
    window.setTimeout(() => ring.remove(), 900)
  }

  function movePointer(x, y) {
    installStyle()
    let pointer = document.querySelector('.zupfnoter-capture-pointer')
    if (pointer === null) {
      pointer = document.createElement('span')
      pointer.className = 'zupfnoter-capture-pointer'
      pointer.innerHTML = '<svg viewBox="0 0 30 38" aria-hidden="true"><path d="M3 2v29l8-8 6 13 6-3-6-13h11z" fill="#ff9f1c" stroke="#102a43" stroke-width="2.4" stroke-linejoin="round"/></svg>'
      document.body.append(pointer)
    }
    pointer.style.left = `${x}px`
    pointer.style.top = `${y}px`
    pointer.style.opacity = '1'
  }

  function playClick() {
    const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext
    if (AudioContextConstructor === undefined) return

    const context = new AudioContextConstructor()
    const sampleCount = Math.max(1, Math.floor(context.sampleRate * 0.025))
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let index = 0; index < samples.length; index += 1) {
      const envelope = 1 - index / samples.length
      samples[index] = (Math.random() * 2 - 1) * envelope * envelope
    }

    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = buffer
    filter.type = 'bandpass'
    filter.frequency.value = 1400
    filter.Q.value = 0.8
    gain.gain.value = 0.16
    source.connect(filter)
    filter.connect(gain)
    gain.connect(context.destination)
    source.start()
    source.addEventListener('ended', () => void context.close(), { once: true })
  }

  document.addEventListener('pointerdown', (event) => {
    if (event.button === 1) return
    showRing(event.clientX, event.clientY)
    playClick()
  }, { capture: true })

  document.addEventListener('pointermove', (event) => {
    movePointer(event.clientX, event.clientY)
  }, { capture: true })
})()
