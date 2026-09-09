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
        [ResponseCache(Duration = 30, Location = ResponseCacheLocation.Client, NoStore = false)]
        public async Task<String> SendMessage(String Receiver, String MessageBody, String Masking)
        {
            DateTime dateTime = DateTime.Now;
            return dateTime.ToString();
        }
    }
}
