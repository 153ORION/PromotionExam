using System.Threading.Tasks;
using PromotionExam.Application.DTOs.CandidateAttempt;

namespace PromotionExam.Application.Common.Interfaces
{
    public interface ICandidateExamService
    {
        Task<ResponseDTO> GetExamInfo(long hrrecordId);
        Task<ResponseDTO> ExamStart(int examineeId);
        Task<ResponseDTO> CheckExamState(int examineeId);
        Task<ResponseDTO> AnswerSheet(int examineeId);
        Task<ResponseDTO> SubmitAnswer(int examineeId, int questionId, int? answerId, string? answer);
        Task<ResponseDTO> ExamEnd(ExamFinishDTO examFinishDTO);

        Task<ResponseDTO> GetSysUsers();
        Task<ResponseDTO> GetSysUserById(string employeeId);
        Task<ResponseDTO> UpdatePassword(string employeeId, string password);
        Task<ResponseDTO> UserLogin(string employeeId, string password);

        Task<string> SubmitBulkAnswer(string examineeId, string answerString);
        Task<string> SendMessage(string receiver, string messageBody, string masking);
    }
}
