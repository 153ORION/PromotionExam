using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using PromotionExam.Application.Common.Interfaces;

namespace PromotionExam.WebApi.Controllers
{
    [ApiController]
    [Route("Api/[controller]/[action]")]
    public class BulkController : ControllerBase
    {
        private readonly ICandidateExamService _candidateExamService;

        public BulkController(ICandidateExamService candidateExamService)
        {
            _candidateExamService = candidateExamService;
        }

        [HttpPost]
        public async Task<string> SubmitBulkAnswer(string examineeId, string answerString)
        {
            return await _candidateExamService.SubmitBulkAnswer(examineeId, answerString);
        }
    }
}
