using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Application.Common.Interfaces;
using PromotionExam.Application.DTOs.CandidateAttempt;
using PromotionExam.Domain.Entities;
using PromotionExam.Infrastructure.Data;

using System.Net;
using System.Data;
using System.Data.Common;
using System.Text.Json;


namespace PromotionExam.Infrastructure.Services
{
    public class CandidateExamService : ICandidateExamService
    {
        private readonly ApplicationDbContext _context;
        private readonly ICryptographyService _crypto;
        private readonly IUserActivityService _activityService;

        public CandidateExamService(
            ApplicationDbContext context,
            ICryptographyService crypto,
            IUserActivityService activityService)
        {
            _context = context;
            _crypto = crypto;
            _activityService = activityService;
        }

        public async Task<ResponseDTO> GetExamInfo(long hrrecordId)
        {
            ResponseDTO response = new ResponseDTO();
            try
            {
                int currentYear = DateTime.Now.Year;

                ExamDashboardDTO? examRegistration = await Task.FromResult((from ER in _context.ExamRegistrations
                                                                           join B in _context.ExamBatches on ER.BatchId equals B.BatchId
                                                                           join QS in _context.QuestionSets on ER.QuestionSetId equals QS.SetId
                                                                           join GRD in _context.SysLookups on QS.GradeId equals GRD.LookupId
                                                                           where ER.HRRecordId == hrrecordId && B.ExamYear == currentYear && ER.IsExamEnd == false && B.IsActive == true && ER.IsActive == true
                                                                           select new ExamDashboardDTO
                                                                           {
                                                                               ExamineeId = ER.ExamineeId,
                                                                               HrrecordId = ER.HRRecordId,
                                                                               BatchId = ER.BatchId,
                                                                               ExamName = B.ExamName,
                                                                               ExamYear = B.ExamYear,
                                                                               QuestionSetId = ER.QuestionSetId,
                                                                               ExamGradeId = QS.GradeId,
                                                                               ExamGradeName = GRD.LookupText,

                                                                               MCQQuestion = B.MCQQuestion,
                                                                               MaxMCQQuestion = B.MaxMCQ,
                                                                               MCQMark = B.MCQMark,

                                                                               AcademicQuestion = B.AcademicQuestion,
                                                                               GeneralQuestion = B.GeneralQuestion,
                                                                               JobRelatedQuestion = B.JobRelatedQuestion,
                                                                               TotalWrittenQuestion = B.TotalWrittenQuestion,

                                                                               MaxAcademicQuestion = B.MaxAcademic,
                                                                               MaxGeneralQuestion = B.MaxGeneral,
                                                                               MaxJobRelatedQuestion = B.MaxJobRelated,

                                                                               TotalQuestion = (B.TotalWrittenQuestion + B.MCQQuestion),
                                                                               WrittenMark = B.WrittenMark,
                                                                               TotalMark = B.TotalMark,

                                                                               Mcqscore = ER.MCQScore,
                                                                               WrittenScore = ER.WrittenScore,
                                                                               TotalScore = ER.TotalScore,

                                                                               ExamDuration = B.ExamDuration,
                                                                               ExamStart = ER.ExamStart,
                                                                               ExamEnd = ER.ExamEnd,

                                                                               IsAttand = ER.IsAttand,
                                                                               IsTimeExpire = ER.IsTimeExpire,
                                                                               IsActive = ER.IsActive == true,
                                                                               EntryBy = ER.EntryBy,
                                                                               EntryDate = ER.EntryDate
                                                                           }).FirstOrDefault());

                if (examRegistration == null)
                {
                    response.Status = HttpStatusCode.NoContent;
                    response.Message = "No exam info found.";
                    response.Data = null;
                }
                else
                {
                    response.Status = HttpStatusCode.OK;
                    response.Message = "Exam info found";
                    response.Data = examRegistration;
                }
            }
            catch (Exception ex)
            {
                response.Status = HttpStatusCode.InternalServerError;
                response.Message = "An error has occured: " + ex.Message;
                response.Data = null;
            }

            return response;
        }

        public async Task<ResponseDTO> CheckExamState(int examineeId)
        {
            ResponseDTO response = new ResponseDTO();
            try
            {
                ExamRegistration? examRegistration = await _context.ExamRegistrations.Where(Reg => (Reg.ExamineeId == examineeId)).FirstOrDefaultAsync();

                if (examRegistration == null)
                {
                    response.Status = HttpStatusCode.NoContent;
                    response.Message = "No exam info found.";
                    response.Data = null;
                }
                else
                {
                    response.Status = HttpStatusCode.OK;
                    response.Message = "Exam info found";
                    response.Data = examRegistration;
                }
            }
            catch (Exception ex)
            {
                response.Status = HttpStatusCode.InternalServerError;
                response.Message = "An error has occured: " + ex.Message;
                response.Data = null;
            }

            return response;
        }

        public async Task<ResponseDTO> ExamStart(int examineeId)
        {
            var response = new ResponseDTO();
            var examSheet = new ExamSheet();
            try
            {
                await _context.Database.OpenConnectionAsync();
                try
                {
                    var connection = _context.Database.GetDbConnection();

                    // Action = 'Q' : Load question list
                    using (var cmd = connection.CreateCommand())
                    {
                        cmd.CommandText = "dbo.SP_APP_EXAM_START";
                        cmd.CommandType = CommandType.StoredProcedure;

                        var pExamineeId = cmd.CreateParameter();
                        pExamineeId.ParameterName = "@ExamineeId";
                        pExamineeId.Value = examineeId;
                        cmd.Parameters.Add(pExamineeId);

                        var pAction = cmd.CreateParameter();
                        pAction.ParameterName = "@Action";
                        pAction.Value = "Q";
                        cmd.Parameters.Add(pAction);

                        using var reader = await cmd.ExecuteReaderAsync();
                        while (await reader.ReadAsync())
                        {
                            examSheet.questionList.Add(new ExamQuestion
                            {
                                questionId = GetInt(reader, "questionId"),
                                questionDetails = GetString(reader, "questionDetails"),
                                questionTypeId = GetInt(reader, "questionTypeId"),
                                mark = GetDecimal(reader, "mark"),
                                examStart = GetDateTime(reader, "examStart"),
                                examEnd = GetDateTime(reader, "examEnd"),
                                examDuration = GetInt(reader, "examDuration"),
                                serverTime = GetDateTime(reader, "serverTime"),
                                categoryId = GetInt(reader, "categoryId"),
                                maxAcademic = GetInt(reader, "maxAcademic"),
                                maxGeneral = GetInt(reader, "maxGeneral"),
                                maxJobRelated = GetInt(reader, "maxJobRelated"),
                                maxMcq = GetInt(reader, "maxMcq"),
                                questionSeq = GetInt(reader, "questionSeq"),
                                statusMessage = GetString(reader, "statusMessage")
                            });
                        }
                    }

                    // Action = 'O' : Load MCQ options
                    using (var cmd = connection.CreateCommand())
                    {
                        cmd.CommandText = "dbo.SP_APP_EXAM_START";
                        cmd.CommandType = CommandType.StoredProcedure;

                        var pExamineeId = cmd.CreateParameter();
                        pExamineeId.ParameterName = "@ExamineeId";
                        pExamineeId.Value = examineeId;
                        cmd.Parameters.Add(pExamineeId);

                        var pAction = cmd.CreateParameter();
                        pAction.ParameterName = "@Action";
                        pAction.Value = "O";
                        cmd.Parameters.Add(pAction);

                        using var reader = await cmd.ExecuteReaderAsync();
                        while (await reader.ReadAsync())
                        {
                            examSheet.mcqOption.Add(new McqOption
                            {
                                optionId = GetInt(reader, "optionId"),
                                questionId = GetInt(reader, "questionId"),
                                optionDetails = GetString(reader, "optionDetails"),
                                answerSerial = GetInt(reader, "answerSerial")
                            });
                        }
                    }
                }
                finally
                {
                    await _context.Database.CloseConnectionAsync();
                }

                if (examSheet.questionList.Count == 1)
                {
                    response.Data = null;
                    response.Status = HttpStatusCode.NotFound;
                    response.Message = examSheet.questionList[0].statusMessage;
                }
                else if (examSheet.questionList.Count > 0)
                {
                    response.Data = examSheet;
                    response.Status = HttpStatusCode.OK;
                    response.Message = "Exam Started!";
                }
                else
                {
                    response.Data = null;
                    response.Status = HttpStatusCode.NotFound;
                    response.Message = "Failed to start";
                }
            }
            catch (Exception)
            {
                response.Data = null;
                response.Status = HttpStatusCode.NotFound;
                response.Message = "Failed to start";
            }

            return response;
        }

        public async Task<ResponseDTO> AnswerSheet(int examineeId)
        {
            var response = new ResponseDTO();
            try
            {
                var answers = await (from a in _context.ExamAnswerSheets
                                     join q in _context.QuestionBanks on a.QuestionId equals q.QuestionId into qGroup
                                     from q in qGroup.DefaultIfEmpty()
                                     where a.ExamineeId == examineeId
                                     select new SubmitAnsDTO
                                     {
                                         examineeId = a.ExamineeId,
                                         questionId = a.QuestionId,
                                         answerId = a.AnswerId,
                                         answer = a.Answer,
                                         questionTypeId = q != null ? q.TypeId : 1
                                     }).ToListAsync();

                if (answers.Count > 0)
                {
                    response.Status = HttpStatusCode.OK;
                    response.Message = "Answersheet found";
                    response.Data = answers;
                }
                else
                {
                    response.Status = HttpStatusCode.NotFound;
                    response.Message = "Answersheet not found";
                    response.Data = null;
                }
            }
            catch (Exception ex)
            {
                response.Status = HttpStatusCode.InternalServerError;
                response.Message = "An error has occurred: " + ex.Message;
            }

            return response;
        }

        public async Task<ResponseDTO> SubmitAnswer(int examineeId, int questionId, int? answerId, string? answer)
        {
            var response = new ResponseDTO();
            try
            {
                var existing = await _context.ExamAnswerSheets
                    .FirstOrDefaultAsync(a => a.ExamineeId == examineeId && a.QuestionId == questionId);

                if (existing != null)
                {
                    existing.AnswerId = answerId;
                    existing.Answer = answer;
                    existing.EntryDate = DateTime.Now;
                }
                else
                {
                    _context.ExamAnswerSheets.Add(new ExamAnswerSheet
                    {
                        ExamineeId = examineeId,
                        QuestionId = questionId,
                        AnswerId = answerId,
                        Answer = answer,
                        EntryDate = DateTime.Now
                    });
                }

                await _context.SaveChangesAsync();

                response.Status = HttpStatusCode.OK;
                response.Message = "Success";
                response.Data = new AnswerSubmitResult
                {
                    currentTime = DateTime.Now,
                    submitStatus = "Success"
                };
            }
            catch (Exception ex)
            {
                response.Status = HttpStatusCode.InternalServerError;
                response.Message = "Failed to submit: " + ex.Message;
                response.Data = new AnswerSubmitResult { submitStatus = "Failed" };
            }

            return response;
        }

        public async Task<ResponseDTO> ExamEnd(ExamFinishDTO examFinishDTO)
        {
            var response = new ResponseDTO();
            var examEndResult = new ExamEndResult { submitStatus = "Failed" };
            try
            {
                string jsonData = JsonSerializer.Serialize(examFinishDTO.answer);

                await _context.Database.OpenConnectionAsync();
                try
                {
                    var connection = _context.Database.GetDbConnection();

                    using var cmd = connection.CreateCommand();
                    cmd.CommandText = "dbo.SP_APP_EXAM_END";
                    cmd.CommandType = CommandType.StoredProcedure;

                    var pExamineeId = cmd.CreateParameter();
                    pExamineeId.ParameterName = "@examineeId";
                    pExamineeId.Value = examFinishDTO.examineeId;
                    cmd.Parameters.Add(pExamineeId);

                    var pDeviceTime = cmd.CreateParameter();
                    pDeviceTime.ParameterName = "@deviceTime";
                    pDeviceTime.Value = examFinishDTO.machineTime;
                    cmd.Parameters.Add(pDeviceTime);

                    var pJsonData = cmd.CreateParameter();
                    pJsonData.ParameterName = "@jsonData";
                    pJsonData.Value = jsonData ?? (object)DBNull.Value;
                    cmd.Parameters.Add(pJsonData);

                    using var reader = await cmd.ExecuteReaderAsync();
                    if (await reader.ReadAsync())
                    {
                        examEndResult = new ExamEndResult
                        {
                            submitStatus = GetString(reader, "submitStatus"),
                            submitTime = GetDateTime(reader, "submitTime")
                        };
                    }
                }
                finally
                {
                    await _context.Database.CloseConnectionAsync();
                }
            }
            catch (Exception)
            {
                examEndResult = new ExamEndResult { submitStatus = "Failed" };
            }

            if (examEndResult.submitStatus != "Failed")
            {
                response.Data = examEndResult;
                response.Status = HttpStatusCode.OK;
                response.Message = examEndResult.submitStatus;
            }
            else
            {
                response.Data = null;
                response.Status = HttpStatusCode.NotFound;
                response.Message = "Failed to end exam";
            }

            return response;
        }

        public async Task<ResponseDTO> GetSysUsers()
        {
            var response = new ResponseDTO();
            try
            {
                var users = await _context.SysUserRegistrations
                    .OrderBy(u => u.Name)
                    .Select(u => new
                    {
                        u.HRRecordId,
                        u.LoginId,
                        u.Name,
                        u.Email,
                        u.Designation,
                        u.CompanyName,
                        u.DepartmentName,
                        u.LocationName,
                        u.GradeName,
                        u.IsActive,
                        u.IsAdmin,
                        u.IsSuperAdmin
                    })
                    .ToListAsync();

                response.Status = HttpStatusCode.OK;
                response.Message = $"Total {users.Count} records found.";
                response.Data = users;
            }
            catch (Exception ex)
            {
                response.Status = HttpStatusCode.InternalServerError;
                response.Message = "An error has occurred: " + ex.Message;
            }

            return response;
        }

        public async Task<ResponseDTO> GetSysUserById(string employeeId)
        {
            var response = new ResponseDTO();
            try
            {
                var user = await _context.SysUserRegistrations
                    .Where(u => u.LoginId == employeeId || (u.Email != null && u.Email == employeeId))
                    .Select(u => new
                    {
                        u.HRRecordId,
                        u.LoginId,
                        u.Name,
                        u.Email,
                        u.Designation,
                        u.CompanyName,
                        u.DepartmentName,
                        u.LocationName,
                        u.GradeName,
                        u.IsActive,
                        u.IsAdmin,
                        u.IsSuperAdmin
                    })
                    .FirstOrDefaultAsync();

                if (user == null)
                {
                    response.Status = HttpStatusCode.NoContent;
                    response.Message = "Employee not found.";
                }
                else
                {
                    response.Status = HttpStatusCode.OK;
                    response.Message = "Employee found with " + employeeId;
                    response.Data = user;
                }
            }
            catch (Exception ex)
            {
                response.Status = HttpStatusCode.InternalServerError;
                response.Message = "An error has occurred: " + ex.Message;
            }

            return response;
        }

        public async Task<ResponseDTO> UpdatePassword(string employeeId, string password)
        {
            var response = new ResponseDTO();
            try
            {
                var user = await _context.SysUserRegistrations
                    .FirstOrDefaultAsync(u => u.LoginId == employeeId);

                if (user == null)
                {
                    response.Status = HttpStatusCode.NoContent;
                    response.Message = "Employee not found.";
                }
                else
                {
                    user.Password = _crypto.EncryptLegacy(password);
                    user.PasswordUpdateTime = DateTime.Now;
                    await _context.SaveChangesAsync();

                    response.Status = HttpStatusCode.OK;
                    response.Message = "Password has been change successful.";
                }
            }
            catch (Exception ex)
            {
                response.Status = HttpStatusCode.InternalServerError;
                response.Message = "An error has occurred: " + ex.Message;
            }

            return response;
        }

        public async Task<ResponseDTO> UserLogin(string employeeId, string password)
        {
            var response = new ResponseDTO();
            try
            {
                var user = await _context.SysUserRegistrations
                    .FirstOrDefaultAsync(u => u.LoginId == employeeId || (u.Email != null && u.Email == employeeId));

                if (user == null || !_crypto.VerifyPassword(password, user.Password ?? string.Empty))
                {
                    response.Status = HttpStatusCode.NoContent;
                    response.Message = "Wrong credential";
                    response.Data = null;
                }
                else
                {
                    response.Status = HttpStatusCode.OK;
                    response.Message = "Login successful.";
                    response.Data = new
                    {
                        user.HRRecordId,
                        user.LoginId,
                        user.Name,
                        user.Email,
                        user.Designation,
                        user.CompanyName,
                        user.DepartmentName,
                        user.LocationName,
                        user.IsAdmin,
                        user.IsSuperAdmin
                    };
                }
            }
            catch (Exception ex)
            {
                response.Status = HttpStatusCode.InternalServerError;
                response.Message = "An error has occurred: " + ex.Message;
            }

            return response;
        }

        public Task<string> SubmitBulkAnswer(string examineeId, string answerString)
        {
            return Task.FromResult(DateTime.Now.ToString("o"));
        }

        public Task<string> SendMessage(string receiver, string messageBody, string masking)
        {
            return Task.FromResult(DateTime.Now.ToString("o"));
        }

        #region -------- Stored Procedure Reader Helpers --------

        private static int GetInt(DbDataReader reader, string column)
        {
            var value = reader[column];
            return value == DBNull.Value ? 0 : Convert.ToInt32(value);
        }

        private static decimal GetDecimal(DbDataReader reader, string column)
        {
            var value = reader[column];
            return value == DBNull.Value ? 0m : Convert.ToDecimal(value);
        }

        private static DateTime GetDateTime(DbDataReader reader, string column)
        {
            var value = reader[column];
            return value == DBNull.Value ? DateTime.MinValue : Convert.ToDateTime(value);
        }

        private static string GetString(DbDataReader reader, string column)
        {
            var value = reader[column];
            return value == DBNull.Value ? string.Empty : value.ToString() ?? string.Empty;
        }

        #endregion -------- Stored Procedure Reader Helpers --------
    }
}
