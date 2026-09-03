using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using PromotionExam.Application.Common.Interfaces;

namespace PromotionExam.WebApi.Controllers
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class MessageController : ControllerBase
    {
        private readonly ICandidateExamService _candidateExamService;

        public MessageController(ICandidateExamService candidateExamService)
        {
            _candidateExamService = candidateExamService;
        }

        [HttpGet]
        public async Task<string> SendMessage(string Receiver, string MessageBody, string Masking)
        {
            return await _candidateExamService.SendMessage(Receiver, MessageBody, Masking);
        }
    }
}
