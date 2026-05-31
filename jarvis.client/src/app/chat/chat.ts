import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

declare var webkitSpeechRecognition: any;
declare var SpeechRecognition: any;

@Component({
  selector: 'app-chat',
  templateUrl: './chat.html',
  standalone: false,
  styleUrl: './chat.css'
})
export class ChatComponent implements OnInit, OnDestroy {
  message = '';
  replyHtml: SafeHtml | null = null;
  hasReply = false;
  loading = false;
  error: string | null = null;
  listening = false;
  speechSupported = false;
  speaking = false;
  ttsSupported = false;
  activated = false;
  clock = '';

  private recognition: any;
  private lastReplyText = '';
  private clockTimer: any;
  private abortController: AbortController | null = null;
  private sessionId: string | null = sessionStorage.getItem('jarvis_session_id');
  private pendingParagraphs: string[] = [];
  awaitingMore = false;

  constructor(private sanitizer: DomSanitizer, private zone: NgZone) {}

  ngOnInit() {
    this.updateClock();
    this.clockTimer = setInterval(() => this.zone.run(() => this.updateClock()), 1000);

    this.ttsSupported = 'speechSynthesis' in window;
    if (this.ttsSupported) {
      // Chrome loads voices asynchronously; trigger early so they're ready on first reply
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechAPI) {
      this.speechSupported = true;
      this.recognition = new SpeechAPI();
      this.recognition.lang = 'en-US';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
      this.recognition.continuous = true;

      this.recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];
        if (!result.isFinal) return;
        const transcript = result[0].transcript;
        this.zone.run(() => {
          const t = transcript.trim().toLowerCase();
          if (t.includes('shut down') || t.includes('shutdown') || t.includes('goodbye jarvis') || t.includes('goodbye')) {
            this.shutdown();
            return;
          }
          if (this.speaking && (t.includes('stop') || t.includes('be quiet') || t.includes('shut up'))) {
            window.speechSynthesis.cancel();
            this.speaking = false;
            this.pendingParagraphs = [];
            this.awaitingMore = false;
            return;
          }
          if (this.awaitingMore) {
            if (t.includes('yes') || t.includes('yeah') || t.includes('sure') || t.includes('go ahead') || t.includes('continue')) {
              this.awaitingMore = false;
              setTimeout(() => {
                window.speechSynthesis.cancel();
                this.zone.run(() => this.speaking = true);
                this.speakNextBatch(true);
              }, 300);
            } else if (t.includes('no') || t.includes('nope') || t.includes('that\'s fine') || t.includes('that is fine') || t.includes('no thanks') || t.includes('never mind')) {
              this.awaitingMore = false;
              this.pendingParagraphs = [];
              this.speak('Of course. What else can I help you with?', true);
            }
            return;
          }
          if (t.includes('hello jarvis') || t.includes('hey jarvis')) {
            this.activated = true;
            const hour = new Date().getHours();
            const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
            this.speak(`Hello sir Adrian, good ${timeOfDay} to you. How may I assist you?`, true);
            return;
          }
          if (!this.activated) return;
          this.message = transcript;
          this.send();
        });
      };

      this.recognition.onerror = (event: any) => {
        this.zone.run(() => {
          this.listening = false;
          // Always restart; 'no-speech' is harmless and we need the mic live while speaking
          setTimeout(() => this.startListening(), event.error === 'no-speech' ? 0 : 300);
        });
      };

      this.recognition.onend = () => {
        this.zone.run(() => {
          this.listening = false;
          this.startListening();
        });
      };

      this.startListening();
    }
  }

  private startListening() {
    if (!this.recognition || this.listening) return;
    try {
      this.recognition.start();
      this.listening = true;
    } catch {}
  }

  ngOnDestroy() {
    if (this.recognition) this.recognition.abort();
    if (this.ttsSupported) window.speechSynthesis.cancel();
    clearInterval(this.clockTimer);
  }

  private updateClock() {
    const now = new Date();
    this.clock = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  speak(text?: string, full = false) {
    if (!this.ttsSupported) return;
    window.speechSynthesis.cancel();
    const raw = text ?? this.lastReplyText;
    if (!raw) return;

    const sentences = raw
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    this.pendingParagraphs = sentences.length > 0 ? sentences : [raw];
    this.awaitingMore = false;
    this.zone.run(() => this.speaking = true);
    this.speakNextBatch(full);
  }

  private speakNextBatch(full = false) {
    if (this.pendingParagraphs.length === 0) {
      this.zone.run(() => { this.speaking = false; this.startListening(); });
      return;
    }

    // Full mode: speak everything at once (greetings, short system phrases)
    // Normal mode: speak 2 sentences then ask if user wants more
    const batch = full
      ? this.pendingParagraphs.splice(0, this.pendingParagraphs.length)
      : this.pendingParagraphs.splice(0, 2);

    const utterance = new SpeechSynthesisUtterance(batch.join(' '));
    utterance.lang = 'en-GB';
    utterance.pitch = 0.85;
    utterance.rate = 0.92;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferred = [
      'Google UK English Female',
      'Microsoft Hazel - English (United Kingdom)',
      'Microsoft Libby Online (Natural) - English (United Kingdom)',
      'Microsoft Mia - English (United Kingdom)',
      'Karen',
      'Moira',
    ];
    const voice =
      preferred.reduce<SpeechSynthesisVoice | null>((found, name) =>
        found ?? voices.find(v => v.name === name) ?? null, null) ??
      voices.find(v => v.lang.startsWith('en-GB') && v.name.toLowerCase().includes('female')) ??
      voices.find(v => v.lang.startsWith('en-GB')) ??
      null;
    if (voice) utterance.voice = voice;

    utterance.onend = () => this.zone.run(() => {
      this.speaking = false;
      if (!full && this.pendingParagraphs.length > 0) {
        this.awaitingMore = true;
        setTimeout(() => {
          const prompt = new SpeechSynthesisUtterance('Would you like to hear more?');
          prompt.lang = 'en-GB'; prompt.pitch = 0.85; prompt.rate = 0.92; prompt.volume = 1;
          if (voice) prompt.voice = voice;
          prompt.onstart = () => this.zone.run(() => this.speaking = true);
          prompt.onend = () => this.zone.run(() => { this.speaking = false; this.startListening(); });
          window.speechSynthesis.speak(prompt);
        }, 300);
      } else {
        this.startListening();
      }
    });
    utterance.onerror = () => this.zone.run(() => { this.speaking = false; this.startListening(); });
    window.speechSynthesis.speak(utterance);
  }

  private shutdown() {
    this.recognition?.abort();
    this.activated = false;
    if (!this.ttsSupported) { window.close(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('Okay sir Adrian, bye for now. Cheers.');
    utterance.lang = 'en-GB';
    utterance.pitch = 0.85;
    utterance.rate = 0.92;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = [
      'Google UK English Female',
      'Microsoft Hazel - English (United Kingdom)',
      'Microsoft Libby Online (Natural) - English (United Kingdom)',
      'Microsoft Mia - English (United Kingdom)',
      'Karen', 'Moira',
    ];
    const voice =
      preferred.reduce<SpeechSynthesisVoice | null>((found, name) =>
        found ?? voices.find(v => v.name === name) ?? null, null) ??
      voices.find(v => v.lang.startsWith('en-GB') && v.name.toLowerCase().includes('female')) ??
      voices.find(v => v.lang.startsWith('en-GB')) ??
      null;
    if (voice) utterance.voice = voice;
    utterance.onend = () => window.close();
    utterance.onerror = () => window.close();
    window.speechSynthesis.speak(utterance);
  }

  private stripMarkdown(text: string): string {
    return text
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/^\s*[\*\-]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '');
  }

  private parseMarkdown(text: string): string {
    const inline = (s: string) =>
      s
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>');

    const lines = text.split('\n');
    let html = '';
    let inOl = false;
    let inUl = false;

    const closeLists = () => {
      if (inOl) { html += '</ol>'; inOl = false; }
      if (inUl) { html += '</ul>'; inUl = false; }
    };

    for (const raw of lines) {
      const line = raw.trimEnd();
      const olMatch = line.match(/^\s*\d+\.\s+(.+)/);
      const ulMatch = line.match(/^\s*[\*\-]\s+(.+)/);
      const h3 = line.match(/^###\s+(.+)/);
      const h2 = line.match(/^##\s+(.+)/);
      const h1 = line.match(/^#\s+(.+)/);

      if (h3) {
        closeLists();
        html += `<h3>${inline(h3[1])}</h3>`;
      } else if (h2) {
        closeLists();
        html += `<h2>${inline(h2[1])}</h2>`;
      } else if (h1) {
        closeLists();
        html += `<h1>${inline(h1[1])}</h1>`;
      } else if (olMatch) {
        if (inUl) { html += '</ul>'; inUl = false; }
        if (!inOl) { html += '<ol>'; inOl = true; }
        html += `<li>${inline(olMatch[1])}</li>`;
      } else if (ulMatch) {
        if (inOl) { html += '</ol>'; inOl = false; }
        if (!inUl) { html += '<ul>'; inUl = true; }
        html += `<li>${inline(ulMatch[1])}</li>`;
      } else if (line === '') {
        // Don't close lists on blank lines — items may resume after a blank line
        if (!inOl && !inUl) { /* gap between paragraphs, p tags handle spacing */ }
      } else {
        closeLists();
        html += `<p>${inline(line)}</p>`;
      }
    }

    closeLists();
    return html;
  }

  async send() {
    if (!this.message.trim()) return;

    this.abortController?.abort();
    this.abortController = new AbortController();

    this.zone.run(() => {
      this.loading = true;
      this.error = null;
      this.replyHtml = null;
      this.hasReply = false;
    });
    let rawText = '';
    let firstEvent = true;

    try {
      const response = await fetch('/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: this.message, sessionId: this.sessionId }),
        signal: this.abortController.signal
      });

      if (!response.ok || !response.body) {
        this.zone.run(() => { this.error = 'Failed to get a response from Gemini.'; this.loading = false; });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;

          // First event carries the session ID
          if (firstEvent) {
            firstEvent = false;
            try {
              const meta = JSON.parse(data);
              if (meta.sessionId) {
                this.sessionId = meta.sessionId;
                sessionStorage.setItem('jarvis_session_id', this.sessionId!);
              }
            } catch { /* not JSON, treat as content */ }
            continue;
          }

          rawText += data.replace(/\\n/g, '\n');
        }

        this.zone.run(() => {
          this.replyHtml = this.sanitizer.bypassSecurityTrustHtml(this.parseMarkdown(rawText));
          this.hasReply = true;
        });
      }

      this.zone.run(() => {
        this.lastReplyText = this.stripMarkdown(rawText);
        this.loading = false;
        this.speak(this.lastReplyText);
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        this.zone.run(() => { this.error = 'Failed to get a response from Gemini.'; this.loading = false; });
        console.error(err);
      }
    }
  }

  async newSession() {
    if (this.sessionId) {
      try {
        await fetch(`/gemini/chat/${this.sessionId}`, { method: 'DELETE' });
      } catch { /* best-effort */ }
    }
    this.sessionId = null;
    sessionStorage.removeItem('jarvis_session_id');
    this.replyHtml = null;
    this.hasReply = false;
    this.error = null;
    this.lastReplyText = '';
    window.speechSynthesis?.cancel();
  }
}
