using PromotionExam.Application.DTOs.Marking;

namespace PromotionExam.Application.Common.Interfaces
{
    public interface IAiMarkingService
    {
        Task<AiRubricDto> GenerateQuestionRubricAsync(int questionId, bool forceRegenerate, long requestedBy);
        Task<AiRubricDto?> GetQuestionRubricAsync(int questionId);
        Task<AiNarrativeEvaluationDto> EvaluateAnswerAsync(int examineeId, int questionId, bool forceReevaluate, long requestedBy);
    }
}
