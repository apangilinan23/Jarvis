using Microsoft.AspNetCore.Mvc;
using Mscc.GenerativeAI;

namespace Jarvis.Server.Controllers
{
    public record ChatRequest(string Message);
    public record ChatResponse(string Reply);

    [ApiController]
    [Route("[controller]")]
    public class GeminiController : ControllerBase
    {
        private readonly GoogleAI _googleAI;
        private readonly IConfiguration _configuration;
        private readonly ILogger<GeminiController> _logger;

        public GeminiController(GoogleAI googleAI, IConfiguration configuration, ILogger<GeminiController> logger)
        {
            _googleAI = googleAI;
            _configuration = configuration;
            _logger = logger;
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

            var modelName = _configuration["Gemini:Model"] ?? "gemini-2.0-flash";

            _logger.LogInformation("Sending message to Gemini ({Model}): {Message}", modelName, request.Message);

            var model = _googleAI.GenerativeModel(model: modelName);
            var response = await model.GenerateContent(request.Message);

            var reply = response.Text;
            _logger.LogInformation("Gemini replied: {Reply}", reply);

            return Ok(new ChatResponse(reply ?? string.Empty));
        }
    }
}
