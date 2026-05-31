using Google.GenAI;

namespace Jarvis.Server.Services
{
    public class GeminiService
    {
        private readonly Client _client;
        private readonly IConfiguration _configuration;
        private readonly ILogger<GeminiService> _logger;

        public GeminiService(Client client, IConfiguration configuration, ILogger<GeminiService> logger)
        {
            _client = client;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<string> Chat(string message)
        {
            var modelName = _configuration["Gemini:Model"] ?? "gemini-2.0-flash";

            _logger.LogInformation("Sending message to Gemini ({Model}): {Message}", modelName, message);

            try
            {
                var response = await _client.Models.GenerateContentAsync(
                    model: modelName,
                    contents: message
                );

                var reply = response.Text ?? string.Empty;
                _logger.LogInformation("Gemini replied: {Reply}", reply);
                return reply;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gemini request failed: {Message}", ex.Message);
                throw;
            }
        }
    }
}
