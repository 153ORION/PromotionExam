using PromotionExam.Application.DTOs.Marking;

namespace PromotionExam.Application.Common.Interfaces
{
    public interface IAiMarkingService
    {
        Task<AiRubricDto> GenerateQuestionRubricAsync(int questionId, bool forceRegenerate, long requestedBy);
        Task<AiRubricDto?> GetQuestionRubricAsync(int questionId);
        Task<AiNarrativeEvaluationDto> EvaluateAnswerAsync(int examineeId, int questionId, bool forceReevaluate, long requestedBy);
        Task<string> GenerateStandardAnswerAsync(int questionId, long requestedBy);
        Task<AutoMarkExamineeResultDto> AutoMarkExamineeAsync(int examineeId, bool forceReevaluate, bool autoApplyScores, long examinerId);
        Task<(bool Success, string Message)> TestGeminiConnectionAsync(string? explicitApiKey = null);
    }
}
