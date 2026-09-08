using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Application.Common.Interfaces;
using PromotionExam.Application.DTOs.CandidateAttempt;
using PromotionExam.Domain.Entities;
using PromotionExam.Infrastructure.Data;

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
            var response = new ResponseDTO();
            try
            {
                var query = from ER in _context.ExamRegistrations
                            join B in _context.ExamBatches on ER.BatchId equals B.BatchId
                            join QS in _context.QuestionSets on ER.QuestionSetId equals QS.SetId
                            join GRD in _context.SysLookups on QS.GradeId equals GRD.LookupId into grdGroup
                            from GRD in grdGroup.DefaultIfEmpty()
                            where ER.HRRecordId == hrrecordId && ER.IsExamEnd == false && B.IsActive == true && ER.IsActive == true && QS.IsActive == true
                            select new ExamDashboardDTO
                            {
                                ExamineeId = ER.ExamineeId,
                                HrrecordId = ER.HRRecordId,
                                BatchId = ER.BatchId,
                                ExamName = B.ExamName,
                                ExamYear = B.ExamYear,
                                QuestionSetId = ER.QuestionSetId,
                                ExamGradeId = QS.GradeId,
                                ExamGradeName = GRD != null ? GRD.LookupText : null,

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

                                TotalQuestion = (B.TotalWrittenQuestion ?? 0) + (B.MCQQuestion ?? 0),
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
                            };

                var examRegistration = await query.FirstOrDefaultAsync();

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
                response.Message = "An error has occurred: " + ex.Message;
                response.Data = null;
            }

            return response;
        }

        public async Task<ResponseDTO> CheckExamState(int examineeId)
        {
            var response = new ResponseDTO();
            try
            {
                var reg = await _context.ExamRegistrations
                    .Include(r => r.Batch)
                    .Include(r => r.QuestionSet)
                    .FirstOrDefaultAsync(r => r.ExamineeId == examineeId);

                if (reg == null)
                {
                    response.Status = HttpStatusCode.NoContent;
                    response.Message = "No exam registration found.";
                    response.Data = null;
                }
                else
                {
                    response.Status = HttpStatusCode.OK;
                    response.Message = "Exam info found";
                    response.Data = new
                    {
                        reg.ExamineeId,
                        reg.HRRecordId,
                        reg.BatchId,
                        reg.QuestionSetId,
                        reg.ExamStart,
                        reg.ExamEnd,
                        reg.IsAttand,
                        reg.IsExamEnd,
                        reg.IsTimeExpire,
                        reg.MCQScore,
                        reg.WrittenScore,
                        reg.TotalScore
                    };
                }
            }
            catch (Exception ex)
            {
                response.Status = HttpStatusCode.InternalServerError;
                response.Message = "An error has occurred: " + ex.Message;
                response.Data = null;
            }

            return response;
        }

        public async Task<ResponseDTO> ExamStart(int examineeId)
        {
            var response = new ResponseDTO();
            try
            {
                var reg = await _context.ExamRegistrations
                    .Include(r => r.Batch)
                    .Include(r => r.QuestionSet)
                    .FirstOrDefaultAsync(r => r.ExamineeId == examineeId);

                if (reg == null)
                {
                    response.Status = HttpStatusCode.NotFound;
                    response.Message = "Examinee registration not found.";
                    return response;
                }

                if (reg.IsExamEnd == true)
                {
                    response.Status = HttpStatusCode.BadRequest;
                    response.Message = "Examination has already been completed and submitted.";
                    return response;
                }

                var duration = reg.Batch?.ExamDuration ?? 60;
                var now = DateTime.UtcNow;

                if (reg.IsAttand != true)
                {
                    reg.IsAttand = true;
                    reg.ExamStart = now;
                    reg.ExamEnd = now.AddMinutes(duration);
                    await _context.SaveChangesAsync();
                }

                var maxAcademic = reg.Batch?.MaxAcademic ?? 0;
                var maxGeneral = reg.Batch?.MaxGeneral ?? 0;
                var maxJobRelated = reg.Batch?.MaxJobRelated ?? 0;
                var maxMcq = reg.Batch?.MaxMCQ ?? 0;
                var examStartTime = reg.ExamStart ?? now;
                var examEndTime = reg.ExamEnd ?? now.AddMinutes(duration);

                // Load Questions for assigned Set
                var questions = await _context.QuestionBanks
                    .Where(q => q.SetId == reg.QuestionSetId && q.IsActive == true)
                    .OrderBy(q => q.TypeId)
                    .ThenBy(q => q.QuestionId)
                    .Select(q => new ExamQuestion
                    {
                        questionId = q.QuestionId,
                        questionDetails = q.Question,
                        questionTypeId = q.TypeId,
                        mark = q.Marks,
                        examStart = examStartTime,
                        examEnd = examEndTime,
                        examDuration = duration,
                        serverTime = DateTime.UtcNow,
                        categoryId = q.CategoryId ?? 0,
                        maxAcademic = maxAcademic,
                        maxGeneral = maxGeneral,
                        maxJobRelated = maxJobRelated,
                        maxMcq = maxMcq,
                        questionSeq = q.QuestionId,
                        statusMessage = "Success"
                    })
                    .ToListAsync();

                // Load Options for all loaded MCQ questions
                var questionIds = questions.Where(q => q.questionTypeId == 1).Select(q => q.questionId).ToList();
                var options = await _context.QuestionBankAnswers
                    .Where(a => questionIds.Contains(a.QuestionId))
                    .OrderBy(a => a.QuestionId)
                    .ThenBy(a => a.AnswerSerial)
                    .Select(a => new McqOption
                    {
                        optionId = a.AnswerId,
                        questionId = a.QuestionId,
                        optionDetails = a.AnswerDetails,
                        answerSerial = a.AnswerSerial
                    })
                    .ToListAsync();

                var examSheet = new ExamSheet
                {
                    questionList = questions,
                    mcqOption = options
                };

                response.Status = HttpStatusCode.OK;
                response.Message = "Exam Started!";
                response.Data = examSheet;

                // Log Activity
                var user = await _context.SysUserRegistrations.FindAsync(reg.HRRecordId);
                await _activityService.LogAsync(
                    reg.HRRecordId,
                    user?.LoginId ?? examineeId.ToString(),
                    user?.Name ?? "Examinee",
                    "Examinee",
                    "EXAM",
                    "EXAM_START",
                    $"Candidate started examination '{reg.Batch?.ExamName}'. Assigned questions: {questions.Count}.");
            }
            catch (Exception ex)
            {
                response.Status = HttpStatusCode.InternalServerError;
                response.Message = "Failed to start: " + ex.Message;
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
                    existing.EntryDate = DateTime.UtcNow;
                }
                else
                {
                    _context.ExamAnswerSheets.Add(new ExamAnswerSheet
                    {
                        ExamineeId = examineeId,
                        QuestionId = questionId,
                        AnswerId = answerId,
                        Answer = answer,
                        EntryDate = DateTime.UtcNow
                    });
                }

                await _context.SaveChangesAsync();

                response.Status = HttpStatusCode.OK;
                response.Message = "Success";
                response.Data = new AnswerSubmitResult
                {
                    currentTime = DateTime.UtcNow,
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
            try
            {
                var reg = await _context.ExamRegistrations
                    .Include(r => r.Batch)
                    .FirstOrDefaultAsync(r => r.ExamineeId == examFinishDTO.examineeId);

                if (reg == null)
                {
                    response.Status = HttpStatusCode.NotFound;
                    response.Message = "Examinee registration not found.";
                    return response;
                }

                // If final answers payload was sent, persist them
                if (examFinishDTO.answer != null && examFinishDTO.answer.Count > 0)
                {
                    foreach (var ans in examFinishDTO.answer)
                    {
                        var existing = await _context.ExamAnswerSheets
                            .FirstOrDefaultAsync(a => a.ExamineeId == examFinishDTO.examineeId && a.QuestionId == ans.questionId);

                        if (existing != null)
                        {
                            existing.AnswerId = ans.answerId;
                            existing.Answer = ans.answer;
                            existing.EntryDate = DateTime.UtcNow;
                        }
                        else
                        {
                            _context.ExamAnswerSheets.Add(new ExamAnswerSheet
                            {
                                ExamineeId = examFinishDTO.examineeId,
                                QuestionId = ans.questionId,
                                AnswerId = ans.answerId,
                                Answer = ans.answer,
                                EntryDate = DateTime.UtcNow
                            });
                        }
                    }
                    await _context.SaveChangesAsync();
                }

                // Automatic MCQ Evaluation
                var mcqQuestions = await _context.QuestionBanks
                    .Where(q => q.SetId == reg.QuestionSetId && q.TypeId == 1 && q.IsActive == true)
                    .Include(q => q.Answers)
                    .ToListAsync();

                var candidateAnswers = await _context.ExamAnswerSheets
                    .Where(a => a.ExamineeId == examFinishDTO.examineeId)
                    .ToListAsync();

                decimal totalMcqScore = 0;
                foreach (var q in mcqQuestions)
                {
                    var rightAnswer = q.Answers.FirstOrDefault(a => a.AnswerIsRight == 1);
                    var candidateAns = candidateAnswers.FirstOrDefault(a => a.QuestionId == q.QuestionId);

                    if (rightAnswer != null && candidateAns != null && candidateAns.AnswerId == rightAnswer.AnswerId)
                    {
                        totalMcqScore += q.Marks;
                    }
                }

                reg.MCQScore = totalMcqScore;
                reg.TotalScore = totalMcqScore + (reg.WrittenScore ?? 0);
                reg.IsExamEnd = true;
                reg.LastUpdateTime = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                // Log Activity
                var user = await _context.SysUserRegistrations.FindAsync(reg.HRRecordId);
                await _activityService.LogAsync(
                    reg.HRRecordId,
                    user?.LoginId ?? examFinishDTO.examineeId.ToString(),
                    user?.Name ?? "Examinee",
                    "Examinee",
                    "EXAM",
                    "EXAM_END",
                    $"Candidate submitted exam '{reg.Batch?.ExamName}'. Evaluated MCQ: {totalMcqScore} marks.");

                response.Status = HttpStatusCode.OK;
                response.Message = "Success";
                response.Data = new ExamEndResult
                {
                    submitStatus = "Success",
                    submitTime = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                response.Status = HttpStatusCode.InternalServerError;
                response.Message = "Failed to end exam: " + ex.Message;
                response.Data = new ExamEndResult { submitStatus = "Failed", submitTime = DateTime.UtcNow };
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
                    user.PasswordUpdateTime = DateTime.UtcNow;
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
            return Task.FromResult(DateTime.UtcNow.ToString("o"));
        }

        public Task<string> SendMessage(string receiver, string messageBody, string masking)
        {
            return Task.FromResult(DateTime.UtcNow.ToString("o"));
        }
    }
}
