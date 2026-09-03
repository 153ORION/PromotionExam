using System;

namespace PromotionExam.Application.DTOs.Activity
{
    public class UserActivityDto
    {
        public long ActivityId { get; set; }
        public long? HRRecordId { get; set; }
        public string LoginId { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string ActivityCategory { get; set; } = string.Empty;
        public string ActionName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? IpAddress { get; set; }
        public DateTime Timestamp { get; set; }
        public string? DetailsJson { get; set; }
    }

    public class ActivityOverviewDto
    {
        public int TotalActivities { get; set; }
        public int LoginsCount { get; set; }
        public int ExamsTakenCount { get; set; }
        public int GradingCount { get; set; }
        public int AdminActionsCount { get; set; }
    }
}
