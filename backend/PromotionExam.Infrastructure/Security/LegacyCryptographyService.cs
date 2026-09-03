using System;
using System.Security.Cryptography;
using System.Text;
using PromotionExam.Application.Common.Interfaces;

namespace PromotionExam.Infrastructure.Security
{
    public class LegacyCryptographyService : ICryptographyService
    {
        private const string SecretKey = "OG_1920A";

        public string EncryptLegacy(string plainText)
        {
            if (string.IsNullOrEmpty(plainText))
                return string.Empty;

            byte[] keyArray;
            byte[] toEncryptArray = Encoding.UTF8.GetBytes(plainText);

            using (var hashmd5 = MD5.Create())
            {
                keyArray = hashmd5.ComputeHash(Encoding.UTF8.GetBytes(SecretKey));
            }

            using (var tdes = TripleDES.Create())
            {
                tdes.Key = keyArray;
                tdes.Mode = CipherMode.ECB;
                tdes.Padding = PaddingMode.PKCS7;

                using (var cTransform = tdes.CreateEncryptor())
                {
                    byte[] resultArray = cTransform.TransformFinalBlock(toEncryptArray, 0, toEncryptArray.Length);
                    return Convert.ToBase64String(resultArray);
                }
            }
        }

        public string DecryptLegacy(string cipherText)
        {
            if (string.IsNullOrEmpty(cipherText))
                return string.Empty;

            try
            {
                byte[] keyArray;
                byte[] toEncryptArray = Convert.FromBase64String(cipherText);

                using (var hashmd5 = MD5.Create())
                {
                    keyArray = hashmd5.ComputeHash(Encoding.UTF8.GetBytes(SecretKey));
                }

                using (var tdes = TripleDES.Create())
                {
                    tdes.Key = keyArray;
                    tdes.Mode = CipherMode.ECB;
                    tdes.Padding = PaddingMode.PKCS7;

                    using (var cTransform = tdes.CreateDecryptor())
                    {
                        byte[] resultArray = cTransform.TransformFinalBlock(toEncryptArray, 0, toEncryptArray.Length);
                        return Encoding.UTF8.GetString(resultArray);
                    }
                }
            }
            catch
            {
                return string.Empty;
            }
        }

        public bool VerifyPassword(string inputPassword, string storedPassword)
        {
            if (string.IsNullOrEmpty(inputPassword) || string.IsNullOrEmpty(storedPassword))
                return false;

            // 1. Check legacy TripleDES encryption match
            string encryptedInput = EncryptLegacy(inputPassword);
            if (string.Equals(encryptedInput, storedPassword, StringComparison.Ordinal))
                return true;

            // 2. Fallback check for direct match (e.g. initial plain passwords)
            if (string.Equals(inputPassword, storedPassword, StringComparison.Ordinal))
                return true;

            // 3. Check if stored password decrypts to input
            string decryptedStored = DecryptLegacy(storedPassword);
            if (!string.IsNullOrEmpty(decryptedStored) && string.Equals(decryptedStored, inputPassword, StringComparison.Ordinal))
                return true;

            return false;
        }
    }
}
