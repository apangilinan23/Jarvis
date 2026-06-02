using Google.GenAI;
using Jarvis.Server.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

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

app.UseSwagger();
app.UseSwaggerUI();

if (app.Environment.IsDevelopment())
{
    app.UseDefaultFiles();
    app.MapStaticAssets();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

if (app.Environment.IsDevelopment())
    app.MapFallbackToFile("/index.html");
else
    app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();

app.Run();
