namespace PromotionExam.Application.DTOs.Dashboard
{
    public class DashboardStatsDto
    {
        public int TotalExaminees { get; set; }
        public int TotalCurrentExaminees { get; set; }
        public int TotalExaminers { get; set; }
        public int TotalBatches { get; set; }
        public int TotalQuestionSets { get; set; }
        public int TotalMCQQuestions { get; set; }
        public int TotalWrittenQuestions { get; set; }
        public int TotalCompletedExams { get; set; }
    }
}
