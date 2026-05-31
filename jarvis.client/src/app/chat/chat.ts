import { HttpClient } from '@angular/common/http';
import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

declare var webkitSpeechRecognition: any;
declare var SpeechRecognition: any;

interface ChatResponse {
  reply: string;
}

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

  private recognition: any;

  constructor(private http: HttpClient, private sanitizer: DomSanitizer, private zone: NgZone) {}

  ngOnInit() {
    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechAPI) {
      this.speechSupported = true;
      this.recognition = new SpeechAPI();
      this.recognition.lang = 'en-US';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        this.zone.run(() => {
          this.message = transcript;
          this.listening = false;
          this.send();
        });
      };

      this.recognition.onerror = () => {
        this.zone.run(() => {
          this.listening = false;
          this.error = 'Speech recognition failed. Please try again.';
        });
      };

      this.recognition.onend = () => {
        this.zone.run(() => {
          this.listening = false;
        });
      };
    }
  }

  ngOnDestroy() {
    if (this.recognition) this.recognition.abort();
  }

  toggleListening() {
    if (this.listening) {
      this.recognition.stop();
      this.listening = false;
    } else {
      this.error = null;
      this.recognition.start();
      this.listening = true;
    }
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

  send() {
    if (!this.message.trim()) return;
    this.loading = true;
    this.error = null;
    this.replyHtml = null;
    this.hasReply = false;

    this.http.post<ChatResponse>('/gemini/chat', { message: this.message }).subscribe({
      next: (res) => {
        this.replyHtml = this.sanitizer.bypassSecurityTrustHtml(this.parseMarkdown(res.reply));
        this.hasReply = true;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to get a response from Gemini.';
        this.loading = false;
        console.error(err);
      }
    });
  }
}
