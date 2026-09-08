using System.Security.Cryptography;
using System.Text;

namespace PromotionExam.Application.Common.Ai
{
    public static class AiRubricFingerprint
    {
        public static string Create(string question, string? standardAnswer, decimal maxMarks)
        {
            var raw = $"{question.Trim()}||{(standardAnswer ?? string.Empty).Trim()}||{maxMarks:0.00}";
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
            return Convert.ToHexString(bytes);
        }
    }
}
