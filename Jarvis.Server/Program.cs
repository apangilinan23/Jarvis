using Google.GenAI;
using Jarvis.Server.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();

builder.Services.AddScoped<GeminiService>();
builder.Services.AddSingleton<Jarvis.Server.Services.ConversationStore>();

builder.Services.AddSingleton(serviceProvider =>
{
    var apiKey = builder.Configuration["Gemini:ApiKey"];
    if (string.IsNullOrWhiteSpace(apiKey))
        throw new InvalidOperationException("Gemini:ApiKey is not configured. Add it to appsettings.Development.json.");
    return new Client(apiKey: apiKey);
});

var app = builder.Build();


app.UseDefaultFiles();
app.MapStaticAssets();

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.MapFallbackToFile("/index.html");

app.Run();
