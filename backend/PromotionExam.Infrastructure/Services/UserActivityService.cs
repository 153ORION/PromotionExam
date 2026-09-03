using System;
using System.Threading.Tasks;
using PromotionExam.Application.Common.Interfaces;
using PromotionExam.Domain.Entities;
using PromotionExam.Infrastructure.Data;

namespace PromotionExam.Infrastructure.Services
{
    public class UserActivityService : IUserActivityService
    {
        private readonly ApplicationDbContext _context;

        public UserActivityService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task LogAsync(
            long? hrRecordId,
            string loginId,
            string userName,
            string role,
            string category,
            string action,
            string description,
            string? ipAddress = null,
            string? detailsJson = null)
        {
            try
            {
                var log = new SysUserActivityLog
                {
                    HRRecordId = hrRecordId,
                    LoginId = loginId,
                    UserName = userName,
                    Role = role,
                    ActivityCategory = category,
                    ActionName = action,
                    Description = description,
                    IpAddress = ipAddress,
                    Timestamp = DateTime.UtcNow,
                    DetailsJson = detailsJson
                };

                _context.SysUserActivityLogs.Add(log);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[UserActivityService Error]: {ex.Message}");
            }
        }
    }
}
