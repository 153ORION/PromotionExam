using System.Threading.Tasks;

namespace PromotionExam.Application.Common.Interfaces
{
    public interface IUserActivityService
    {
        Task LogAsync(
            long? hrRecordId,
            string loginId,
            string userName,
            string role,
            string category,
            string action,
            string description,
            string? ipAddress = null,
            string? detailsJson = null);
    }
}
