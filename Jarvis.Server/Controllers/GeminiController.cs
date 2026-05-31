using Microsoft.AspNetCore.Mvc;
using Jarvis.Server.Services;

namespace Jarvis.Server.Controllers
{
    public record ChatRequest(string Message, string? SessionId);

    [ApiController]
    [Route("[controller]")]
    public class GeminiController : ControllerBase
    {
        private readonly GeminiService _geminiService;
        private readonly ConversationStore _store;

        public GeminiController(GeminiService geminiService, ConversationStore store)
        {
            _geminiService = geminiService;
            _store = store;
        }

        /// <summary>
        /// Accepts a text message from Angular, streams the Gemini response as Server-Sent Events.
        /// POST /gemini/chat
        /// Body: { "message": "Hello!", "sessionId": "optional-existing-id" }
        /// The first SSE event is always: data: {"sessionId":"..."}
        /// </summary>
        [HttpPost("chat")]
        public async Task Chat([FromBody] ChatRequest request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
            {
                Response.StatusCode = 400;
                return;
            }

            var sessionId = string.IsNullOrWhiteSpace(request.SessionId)
                ? Guid.NewGuid().ToString("N")
                : request.SessionId;

            var history = _store.GetOrCreate(sessionId);

            Response.Headers.ContentType = "text/event-stream";
            Response.Headers.CacheControl = "no-cache";
            Response.Headers.Connection = "keep-alive";

            // Send the session ID as the first event so the client can persist it
            await Response.WriteAsync($"data: {{\"sessionId\":\"{sessionId}\"}}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);

            await foreach (var chunk in _geminiService.ChatStream(request.Message, history, cancellationToken))
            {
                var escaped = chunk.Replace("\n", "\\n");
                await Response.WriteAsync($"data: {escaped}\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }

            await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }

        /// <summary>
        /// Clears the conversation history for a session.
        /// DELETE /gemini/chat/{sessionId}
        /// </summary>
        [HttpDelete("chat/{sessionId}")]
        public IActionResult ClearSession(string sessionId)
        {
            _store.Remove(sessionId);
            return NoContent();
        }
    }
}
