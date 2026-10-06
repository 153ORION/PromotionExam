using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using ExcelDataReader;
using PromotionExam.Application.DTOs.Questions;

namespace PromotionExam.Infrastructure.Services
{
    // Reads the question sheet of a Question Bank Excel file (reference layout: QB.xlsx, columns
    // Grade, Department, Concentration, Location, Part, Type, Question, Option1-4, Answer) and
    // validates every row. Columns are matched by header name (case, spacing and punctuation are
    // ignored), so column order and header variations such as "Question Type" / "Type" do not matter.
    //
    // Question Type must be MCQ or Descriptive and Question Part must be 1, 2 or 3. Any other value
    // does not block the upload: the row is saved as "disputed". Rows with errors are saved too
    // (flagged HasError). Both are fixed later in Fix Questions, which re-checks an edited row with
    // ValidateQuestion (the same rules as an uploaded row).
    public static class BulkQuestionExcelParser
    {
        public const string PreferredSheetName = "QB";
        public const string TypeMcq = "MCQ";
        public const string TypeDescriptive = "Descriptive";
        public static readonly string[] ValidQuestionTypes = { TypeMcq, TypeDescriptive };
        public static readonly string[] ValidQuestionParts = { "1", "2", "3" };

        private const int HeaderSearchRows = 10;

        static BulkQuestionExcelParser()
        {
            // ExcelDataReader needs the legacy code pages to read .xls files.
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        }

        private sealed record ColumnDef(string Key, string Header, int MaxLength, Func<string, bool> Matches);

        // Long-text columns whose line breaks are meaningful; every other column is cleaned to a single line.
        private static readonly HashSet<string> MultiLineColumns = new() { "Question", "RightAnswer" };

        private static readonly ColumnDef[] Columns =
        {
            new("Grade", "Grade", 100, h => h == "grade" || h == "jobgrade"),
            new("Department", "Department", 200, h => h == "department" || h == "dept"),
            new("JobConcentration", "Concentration", 200, h => h == "concentration" || h == "jobconcentration"),
            new("Location", "Location", 200, h => h == "location"),
            new("QuestionPart", "Part", 50, h => h == "part" || h == "questionpart"),
            new("QuestionType", "Type", 100, h => h == "type" || h == "questiontype"),
            new("Question", "Question", 0, h => h == "question" || h == "questions"),
            new("Option1", "Option1", 0, h => h == "option1"),
            new("Option2", "Option2", 0, h => h == "option2"),
            new("Option3", "Option3", 0, h => h == "option3"),
            new("Option4", "Option4", 0, h => h == "option4"),
            new("RightAnswer", "Answer", 0, h => h == "answer" || h == "rightanswer" || h == "correctanswer"),
        };

        private static readonly string[] RequiredColumns = { "Question", "QuestionType" };

        // Maximum stored length of Grade, Department, JobConcentration, Location, QuestionPart and
        // QuestionType (0 = unlimited). Matches the database column sizes.
        public static int MaxLength(string key) => Columns.First(c => c.Key == key).MaxLength;

        public static BulkQuestionValidationResultDto Parse(Stream stream, string fileName, string? sheetName = null)
        {
            var result = new BulkQuestionValidationResultDto { FileName = fileName };

            DataSet dataSet;
            try
            {
                using var reader = ExcelReaderFactory.CreateReader(stream);
                dataSet = reader.AsDataSet(new ExcelDataSetConfiguration
                {
                    ConfigureDataTable = _ => new ExcelDataTableConfiguration { UseHeaderRow = false }
                });
            }
            catch (Exception ex)
            {
                AddIssue(result, null, null, "Error", "FILE", $"The file could not be read as an Excel workbook ({ex.Message}).");
                return result;
            }

            var candidates = FindQuestionSheets(dataSet);
            result.AvailableSheets = candidates.Select(c => c.Table.TableName).ToList();

            if (candidates.Count == 0)
            {
                var sheets = string.Join(", ", dataSet.Tables.Cast<DataTable>().Select(t => $"'{t.TableName}'"));
                AddIssue(result, null, null, "Error", "FILE",
                    $"No sheet with a question header row was found. The header must contain at least 'Question' and 'Type' columns. Sheets in file: {sheets}.");
                return result;
            }

            var selected = candidates[0];
            if (!string.IsNullOrWhiteSpace(sheetName))
            {
                var match = candidates.FirstOrDefault(c => string.Equals(c.Table.TableName, sheetName.Trim(), StringComparison.OrdinalIgnoreCase));
                if (match.Table == null)
                {
                    AddIssue(result, null, null, "Error", "FILE",
                        $"Sheet '{sheetName}' has no question header row. Sheets with questions: {string.Join(", ", result.AvailableSheets)}.");
                    return result;
                }
                selected = match;
            }

            var (table, headerIndex, columnMap) = selected;
            result.SheetName = table.TableName;
            result.HeaderRowNo = headerIndex + 1;
            result.MissingOptionalColumns = Columns
                .Where(c => !columnMap.ContainsKey(c.Key) && !RequiredColumns.Contains(c.Key))
                .Select(c => c.Header)
                .ToList();

            if (result.MissingOptionalColumns.Count > 0)
            {
                AddIssue(result, null, null, "Warning", "MISSING_COLUMN",
                    $"Column(s) not found in the header row and will be left empty: {string.Join(", ", result.MissingOptionalColumns)}.");
            }

            for (int i = headerIndex + 1; i < table.Rows.Count; i++)
            {
                var dataRow = table.Rows[i];
                int excelRowNo = i + 1;

                var values = new Dictionary<string, string?>();
                int rowCleanedCells = 0;
                foreach (var col in Columns)
                {
                    if (!columnMap.TryGetValue(col.Key, out var idx))
                    {
                        values[col.Key] = null;
                        continue;
                    }

                    var raw = dataRow[idx] is string s ? s : null;
                    var cleaned = CellToString(dataRow[idx], MultiLineColumns.Contains(col.Key));
                    if (raw != null && raw != cleaned) rowCleanedCells++;
                    values[col.Key] = cleaned;
                }

                if (values.Values.All(string.IsNullOrEmpty))
                {
                    result.SkippedEmptyRows++;
                    continue;
                }

                result.CleanedCellCount += rowCleanedCells;

                var row = new BulkQuestionRowDto
                {
                    ExcelRowNo = excelRowNo,
                    Grade = values["Grade"],
                    Department = values["Department"],
                    JobConcentration = values["JobConcentration"],
                    Location = values["Location"],
                    Question = values["Question"] ?? string.Empty,
                    Option1 = values["Option1"],
                    Option2 = values["Option2"],
                    Option3 = values["Option3"],
                    Option4 = values["Option4"],
                    RightAnswer = values["RightAnswer"],
                };

                var typeValue = NormalizeQuestionType(values["QuestionType"]);
                row.QuestionType = typeValue ?? values["QuestionType"];
                row.IsTypeDisputed = typeValue == null;

                var partValue = NormalizeQuestionPart(values["QuestionPart"]);
                row.QuestionPart = partValue ?? values["QuestionPart"];
                row.IsPartDisputed = partValue == null;

                row.IsMcq = row.QuestionType == TypeMcq;

                int errorsBefore = result.ErrorCount;
                ValidateRow(row, values, (column, severity, code, message) => AddIssue(result, excelRowNo, column, severity, code, message));
                row.HasError = result.ErrorCount > errorsBefore;

                result.Rows.Add(row);
            }

            MarkDuplicatesWithinFile(result);

            result.TotalRows = result.Rows.Count;
            result.McqCount = result.Rows.Count(r => r.QuestionType == TypeMcq);
            result.DescriptiveCount = result.Rows.Count(r => r.QuestionType == TypeDescriptive);
            result.DisputedTypeCount = result.Rows.Count(r => r.IsTypeDisputed);
            result.DisputedPartCount = result.Rows.Count(r => r.IsPartDisputed);
            result.ErrorRowCount = result.Rows.Count(r => r.HasError);

            if (result.TotalRows == 0)
                AddIssue(result, null, null, "Error", "FILE", $"Sheet '{table.TableName}' has no question rows below the header row.");

            return result;
        }

        // A question is a duplicate when the question text, the part AND all four criteria (grade,
        // department, concentration, location) match. The same question in a different part or for a
        // different grade/department/concentration/location is allowed. Grades such as "E-1" and "E1"
        // count as the same.
        public static string BuildDuplicateKey(string? question, string? part, string? grade, string? department, string? concentration, string? location)
        {
            static string Text(string? v) => Regex.Replace(v ?? string.Empty, @"\s+", " ").Trim().ToLowerInvariant();
            static string Code(string? v) => new string((v ?? string.Empty).Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
            return string.Join("|", Text(question), Code(part), Code(grade), Code(department), Code(concentration), Code(location));
        }

        public static string BuildDuplicateKey(BulkQuestionRowDto r) =>
            BuildDuplicateKey(r.Question, r.QuestionPart, r.Grade, r.Department, r.JobConcentration, r.Location);

        // Only rows without errors take part: a row that will not be saved cannot be the "original".
        private static void MarkDuplicatesWithinFile(BulkQuestionValidationResultDto result)
        {
            var firstByKey = new Dictionary<string, BulkQuestionRowDto>();
            foreach (var row in result.Rows.Where(r => !r.HasError && !string.IsNullOrEmpty(r.Question)))
            {
                var key = BuildDuplicateKey(row);
                if (firstByKey.TryGetValue(key, out var first))
                {
                    row.DuplicateOfRowNo = first.ExcelRowNo;
                    AddIssue(result, row.ExcelRowNo, "Question", "Warning", "DUPLICATE",
                        $"Duplicate of row {first.ExcelRowNo}: same question, part, grade, department, concentration and location.");
                }
                else
                {
                    firstByKey[key] = row;
                }
            }
        }

        // Returns "MCQ" / "Descriptive" for a valid type (any letter case), otherwise null (disputed).
        public static string? NormalizeQuestionType(string? value)
        {
            var v = value?.Trim();
            return ValidQuestionTypes.FirstOrDefault(t => string.Equals(t, v, StringComparison.OrdinalIgnoreCase));
        }

        // Returns "1" / "2" / "3" for a valid part, otherwise null (disputed).
        public static string? NormalizeQuestionPart(string? value)
        {
            var v = value?.Trim();
            return ValidQuestionParts.Contains(v) ? v : null;
        }

        // Checks the options and answer of an MCQ. Letter answers (a-d, "b)", "(c)") are converted
        // to the option number. Returns the problems found (empty when the MCQ is valid).
        public static List<string> ValidateMcq(string?[] options, string? answer, out string? normalizedAnswer)
        {
            var problems = new List<string>();
            normalizedAnswer = answer;

            int filled = options.Count(o => !string.IsNullOrEmpty(o));
            if (filled < 2)
                problems.Add($"MCQ has {filled} option(s); at least 2 are required.");

            if (string.IsNullOrEmpty(answer))
            {
                problems.Add("MCQ has no Answer.");
                return problems;
            }

            var letter = Regex.Match(answer, @"^\(?([a-dA-D])[\).]?$");
            if (letter.Success)
                normalizedAnswer = (char.ToLowerInvariant(letter.Groups[1].Value[0]) - 'a' + 1).ToString(CultureInfo.InvariantCulture);

            if (int.TryParse(normalizedAnswer, NumberStyles.Integer, CultureInfo.InvariantCulture, out var optionNo))
            {
                if (optionNo < 1 || optionNo > 4)
                    problems.Add($"Answer '{answer}' must be an option number from 1 to 4.");
                else if (string.IsNullOrEmpty(options[optionNo - 1]))
                    problems.Add($"Answer points to Option{optionNo}, which is empty.");
            }
            else if (!options.Any(o => o != null && string.Equals(o, answer, StringComparison.OrdinalIgnoreCase)))
            {
                problems.Add("Answer must be an option number (1-4), a letter (a-d) or match one of the option texts.");
            }

            return problems;
        }

        // Cleans and checks one question edited in Fix Questions with the same rules as an uploaded
        // row. Normalizes Type, Part and a letter MCQ answer in place and sets the disputed flags,
        // IsMcq and HasError. Returns the errors and warnings found.
        public static List<BulkQuestionIssueDto> ValidateQuestion(BulkQuestionRowDto row)
        {
            row.Grade = CleanText(row.Grade, false);
            row.Department = CleanText(row.Department, false);
            row.JobConcentration = CleanText(row.JobConcentration, false);
            row.Location = CleanText(row.Location, false);
            row.Question = CleanText(row.Question, true) ?? string.Empty;
            row.Option1 = CleanText(row.Option1, false);
            row.Option2 = CleanText(row.Option2, false);
            row.Option3 = CleanText(row.Option3, false);
            row.Option4 = CleanText(row.Option4, false);
            row.RightAnswer = CleanText(row.RightAnswer, true);

            var rawType = CleanText(row.QuestionType, false);
            var typeValue = NormalizeQuestionType(rawType);
            row.QuestionType = typeValue ?? rawType;
            row.IsTypeDisputed = typeValue == null;

            var rawPart = CleanText(row.QuestionPart, false);
            var partValue = NormalizeQuestionPart(rawPart);
            row.QuestionPart = partValue ?? rawPart;
            row.IsPartDisputed = partValue == null;

            row.IsMcq = row.QuestionType == TypeMcq;

            var values = new Dictionary<string, string?>
            {
                ["Grade"] = row.Grade, ["Department"] = row.Department, ["JobConcentration"] = row.JobConcentration,
                ["Location"] = row.Location, ["QuestionPart"] = row.QuestionPart, ["QuestionType"] = row.QuestionType,
                ["Question"] = row.Question, ["Option1"] = row.Option1, ["Option2"] = row.Option2,
                ["Option3"] = row.Option3, ["Option4"] = row.Option4, ["RightAnswer"] = row.RightAnswer,
            };

            var issues = new List<BulkQuestionIssueDto>();
            ValidateRow(row, values, (column, severity, code, message) => issues.Add(new BulkQuestionIssueDto
            {
                RowNo = row.ExcelRowNo, Column = column, Severity = severity, Code = code, Message = message
            }));
            row.HasError = issues.Any(i => i.Severity == "Error");
            return issues;
        }

        private delegate void IssueSink(string column, string severity, string code, string message);

        private static void ValidateRow(BulkQuestionRowDto row, Dictionary<string, string?> values, IssueSink add)
        {
            foreach (var col in Columns)
            {
                var v = values[col.Key];
                if (v == null) continue;
                if (col.MaxLength > 0 && v.Length > col.MaxLength)
                    add(col.Header, "Error", "TOO_LONG", $"{col.Header} is {v.Length} characters long; the maximum is {col.MaxLength}.");
                if (v.Contains(ReplacementChar))
                    add(col.Header, "Warning", "UNREADABLE",
                        $"{col.Header} contains unreadable characters ({ReplacementChar}) that cannot be repaired automatically. Retype them.");
            }

            if (string.IsNullOrEmpty(row.Question))
                add("Question", "Error", "EMPTY_QUESTION", "Question text is empty.");

            if (row.IsTypeDisputed)
            {
                add("Type", "Warning", "DISPUTED_TYPE",
                    string.IsNullOrEmpty(row.QuestionType)
                        ? "Type is empty. The question is saved as disputed until it is set to MCQ or Descriptive in Fix Questions."
                        : $"Type '{row.QuestionType}' is not MCQ or Descriptive. The question is saved as disputed until it is fixed in Fix Questions.");
            }

            if (row.IsPartDisputed)
            {
                add("Part", "Warning", "DISPUTED_PART",
                    string.IsNullOrEmpty(row.QuestionPart)
                        ? "Part is empty. The question is saved as disputed until it is set to 1, 2 or 3 in Fix Questions."
                        : $"Part '{row.QuestionPart}' is not 1, 2 or 3. The question is saved as disputed until it is fixed in Fix Questions.");
            }

            if (row.IsMcq)
            {
                var problems = ValidateMcq(new[] { row.Option1, row.Option2, row.Option3, row.Option4 }, row.RightAnswer, out var answer);
                foreach (var p in problems)
                    add("Answer", "Error", "INVALID_MCQ", p);

                if (problems.Count == 0 && answer != row.RightAnswer)
                {
                    add("Answer", "Warning", "ANSWER_CONVERTED", $"Answer '{row.RightAnswer}' was converted to option {answer}.");
                    row.RightAnswer = answer;
                }
            }
            else if (row.QuestionType == TypeDescriptive && string.IsNullOrEmpty(row.RightAnswer))
            {
                add("Answer", "Warning", "NO_ANSWER", "No standard answer given for this descriptive question.");
            }
        }

        private static List<(DataTable Table, int HeaderIndex, Dictionary<string, int> ColumnMap)> FindQuestionSheets(DataSet dataSet)
        {
            // A sheet named "QB" is preferred; otherwise sheets are offered in workbook order.
            var tables = dataSet.Tables.Cast<DataTable>()
                .OrderByDescending(t => string.Equals(t.TableName.Trim(), PreferredSheetName, StringComparison.OrdinalIgnoreCase))
                .ToList();

            var found = new List<(DataTable, int, Dictionary<string, int>)>();
            foreach (var table in tables)
            {
                int limit = Math.Min(HeaderSearchRows, table.Rows.Count);
                for (int i = 0; i < limit; i++)
                {
                    var map = MapHeader(table.Rows[i]);
                    if (RequiredColumns.All(map.ContainsKey))
                    {
                        found.Add((table, i, map));
                        break;
                    }
                }
            }
            return found;
        }

        private static Dictionary<string, int> MapHeader(DataRow headerRow)
        {
            var map = new Dictionary<string, int>();
            for (int c = 0; c < headerRow.ItemArray.Length; c++)
            {
                var header = NormalizeHeader(CellToString(headerRow[c]));
                if (header.Length == 0) continue;

                var def = Columns.FirstOrDefault(d => d.Matches(header));
                if (def != null && !map.ContainsKey(def.Key))
                    map[def.Key] = c;
            }
            return map;
        }

        private static string NormalizeHeader(string? header) =>
            header == null ? string.Empty : new string(header.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();

        private static string? CellToString(object? value, bool multiLine = false)
        {
            string? text = value switch
            {
                null => null,
                DBNull => null,
                double d when d == Math.Floor(d) && Math.Abs(d) < 1e15 => ((long)d).ToString(CultureInfo.InvariantCulture),
                double d => d.ToString("G15", CultureInfo.InvariantCulture),
                DateTime dt => dt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                bool b => b ? "TRUE" : "FALSE",
                _ => Convert.ToString(value, CultureInfo.InvariantCulture)
            };

            return CleanText(text, multiLine);
        }

        // ---- Character repair and whitespace cleaning ----
        // Special characters are written as numeric codes so the source contains no invisible characters.

        private static string Ch(int code) => ((char)code).ToString();

        private static readonly char ReplacementChar = (char)0xFFFD; // the "unknown character" symbol

        private static string Chars(params int[] codes) => new string(codes.Select(c => (char)c).ToArray());

        // Text that was saved as UTF-8 but read back as Windows-1252 ("mojibake"): each character
        // below turns into 2-3 garbage characters, e.g. a right quote becomes a-circumflex, euro sign,
        // trade mark sign. Written as character codes: { garbled sequence, correct character }.
        private static readonly (string Garbled, string Fixed)[] Mojibake =
        {
            (Chars(0xE2, 0x20AC, 0x2122), Ch(0x2019)), // right single quote
            (Chars(0xE2, 0x20AC, 0x2DC), Ch(0x2018)),  // left single quote
            (Chars(0xE2, 0x20AC, 0x153), Ch(0x201C)),  // left double quote
            (Chars(0xE2, 0x20AC, 0x9D), Ch(0x201D)),   // right double quote
            (Chars(0xE2, 0x20AC, 0xA2), Ch(0x2022)),   // bullet
            (Chars(0xE2, 0x20AC, 0x201C), Ch(0x2013)), // en dash
            (Chars(0xE2, 0x20AC, 0x201D), Ch(0x2014)), // em dash
            (Chars(0xE2, 0x20AC, 0xA6), Ch(0x2026)),   // ellipsis
            (Chars(0xE2, 0x201E, 0xA2), Ch(0x2122)),   // trade mark
            (Chars(0xC2, 0xB0), Ch(0xB0)),             // degree
            (Chars(0xC2, 0xB1), Ch(0xB1)),             // plus-minus
            (Chars(0xC2, 0xB7), Ch(0xB7)),             // middle dot
            (Chars(0xC3, 0x2014), Ch(0xD7)),           // multiplication sign
            (Chars(0xC2, 0xA0), " "),                  // non-breaking space
        };

        // Bullets and ticks from the Symbol/Wingdings fonts (pasted from Word). They live in the
        // Unicode Private Use Area and show as boxes or random symbols outside those fonts.
        private static readonly Dictionary<char, string> SymbolFontChars = new()
        {
            [(char)0xF0B7] = Ch(0x2022), [(char)0xF0A7] = Ch(0x2022), [(char)0xF06C] = Ch(0x2022),
            [(char)0xF06E] = Ch(0x2022), [(char)0xF0A8] = Ch(0x2022), [(char)0xF076] = Ch(0x2022),
            [(char)0xF0D8] = Ch(0x2022), [(char)0xF0E0] = Ch(0x2022), [(char)0xF0E8] = Ch(0x2022),
            [(char)0xF0F0] = Ch(0x2022), [(char)0xF0FC] = Ch(0x2713), [(char)0xF0FB] = Ch(0x2717),
        };

        private static readonly Regex PrivateUseChars = new($"[{Ch(0xE000)}-{Ch(0xF8FF)}]", RegexOptions.Compiled);

        // Fixes characters that display as garbage: encoding mix-ups and symbol-font bullets.
        // Any other Private Use Area character is meaningless outside its font and is dropped.
        // The replacement character cannot be recovered; rows containing it get a warning instead.
        private static string RepairCharacters(string text)
        {
            if (text.Contains((char)0xE2) || text.Contains((char)0xC2) || text.Contains((char)0xC3))
            {
                foreach (var (garbled, fixedText) in Mojibake)
                    text = text.Replace(garbled, fixedText, StringComparison.Ordinal);
            }

            return PrivateUseChars.Replace(text, m =>
                SymbolFontChars.TryGetValue(m.Value[0], out var replacement) ? replacement : string.Empty);
        }

        private static readonly Regex ExcelEscapedCr = new(@"_x000[dD]_", RegexOptions.Compiled);
        // CR LF, CR, vertical tab, form feed, NEL, line separator, paragraph separator.
        private static readonly Regex LineBreaks = new(
            $"\r\n|[\r{Ch(0x0B)}{Ch(0x0C)}{Ch(0x85)}{Ch(0x2028)}{Ch(0x2029)}]", RegexOptions.Compiled);
        // Zero-width space/non-joiner/joiner, word joiner, byte-order mark, soft hyphen.
        private static readonly Regex InvisibleChars = new(
            $"[{Ch(0x200B)}-{Ch(0x200D)}{Ch(0x2060)}{Ch(0xFEFF)}{Ch(0xAD)}]", RegexOptions.Compiled);
        private static readonly Regex ControlChars = new(@"[\x00-\x08\x0E-\x1F\x7F]", RegexOptions.Compiled);
        // Any whitespace except '\n': spaces, tabs, non-breaking and other Unicode spaces.
        private static readonly Regex HorizontalSpace = new(@"[^\S\n]+", RegexOptions.Compiled);

        // Repairs garbled characters (see RepairCharacters) and removes unnecessary whitespace from a cell value:
        // - tabs, non-breaking spaces and repeated spaces become a single space;
        // - zero-width characters, soft hyphens and control characters are removed;
        // - leading/trailing spaces are trimmed from the value (and from every line).
        // Single-line columns have line breaks replaced by a space. Multi-line columns
        // (Question, Answer) keep their line breaks, e.g. the bullet points of a descriptive
        // answer, but lose blank lines.
        public static string? CleanText(string? text, bool multiLine)
        {
            if (text == null) return null;

            text = RepairCharacters(text);
            text = ExcelEscapedCr.Replace(text, string.Empty);
            text = LineBreaks.Replace(text, "\n");
            text = InvisibleChars.Replace(text, string.Empty);
            text = ControlChars.Replace(text, string.Empty);
            text = HorizontalSpace.Replace(text, " ");

            var lines = text.Split('\n')
                .Select(l => l.Trim())
                .Where(l => l.Length > 0);

            text = multiLine ? string.Join("\n", lines) : string.Join(" ", lines);
            return text.Length == 0 ? null : text;
        }

        private static void AddIssue(BulkQuestionValidationResultDto result, int? rowNo, string? column, string severity, string code, string message)
        {
            result.Issues.Add(new BulkQuestionIssueDto { RowNo = rowNo, Column = column, Severity = severity, Code = code, Message = message });
            if (severity == "Error")
            {
                result.ErrorCount++;
                if (rowNo == null) result.HasFileError = true;
            }
            else
            {
                result.WarningCount++;
            }
        }
    }
}
