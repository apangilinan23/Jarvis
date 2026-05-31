using Microsoft.AspNetCore.Mvc;
using Jarvis.Server.Services;

namespace Jarvis.Server.Controllers
{
    public record ChatRequest(string Message);
    public record ChatResponse(string Reply);

    [ApiController]
    [Route("[controller]")]
    public class GeminiController : ControllerBase
    {
        private readonly GeminiService _geminiService;

        public GeminiController(GeminiService geminiService)
        {
            _geminiService = geminiService;
        }

        /// <summary>
        /// Accepts a text message from Angular, sends it to Gemini, and returns the response.
        /// POST /gemini/chat
        /// Body: { "message": "Hello!" }
        /// </summary>
        [HttpPost("chat")]
        public async Task<ActionResult<ChatResponse>> Chat([FromBody] ChatRequest request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
                return BadRequest("Message cannot be empty.");

            var reply = await _geminiService.Chat(request.Message);
            return Ok(new ChatResponse(reply));
        }
    }
}
