using Google.GenAI;
using Google.GenAI.Types;

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

        public async IAsyncEnumerable<string> ChatStream(
            string message,
            List<Content> history,
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var modelName = _configuration["Gemini:Model"] ?? "gemini-2.5-flash";

            _logger.LogInformation("Sending message to Gemini ({Model}): {Message}", modelName, message);

            // Append the new user turn to the shared history list
            lock (history)
            {
                history.Add(new Content { Role = "user", Parts = [new Part { Text = message }] });
            }

            IAsyncEnumerable<GenerateContentResponse> stream;
            try
            {
                List<Content> snapshot;
                lock (history) { snapshot = [.. history]; }

                stream = _client.Models.GenerateContentStreamAsync(
                    model: modelName,
                    contents: snapshot,
                    cancellationToken: cancellationToken
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gemini stream request failed: {Message}", ex.Message);
                throw;
            }

            var replyBuilder = new System.Text.StringBuilder();

            await foreach (var chunk in stream.WithCancellation(cancellationToken))
            {
                var text = chunk.Text;
                if (!string.IsNullOrEmpty(text))
                {
                    replyBuilder.Append(text);
                    yield return text;
                }
            }

            // Append the completed model reply to history
            var fullReply = replyBuilder.ToString();
            if (!string.IsNullOrEmpty(fullReply))
            {
                lock (history)
                {
                    history.Add(new Content { Role = "model", Parts = [new Part { Text = fullReply }] });
                }
            }
        }
    }
}
