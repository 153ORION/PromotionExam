namespace PromotionExam.Application.Common.Interfaces
{
    public interface ICurrentUserService
    {
        long? HRRecordId { get; }
        string? LoginId { get; }
        string? Name { get; }
        bool IsAdmin { get; }
        bool IsSuperAdmin { get; }
    }
}
