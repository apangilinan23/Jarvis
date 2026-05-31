using Google.GenAI.Types;
using System.Collections.Concurrent;

namespace Jarvis.Server.Services
{
    public class ConversationStore
    {
        private readonly ConcurrentDictionary<string, List<Content>> _sessions = new();

        public List<Content> GetOrCreate(string sessionId)
            => _sessions.GetOrAdd(sessionId, _ => []);

        public void Remove(string sessionId)
            => _sessions.TryRemove(sessionId, out _);
    }
}
