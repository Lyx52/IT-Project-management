using System.Diagnostics;
using System.Net;
using System.Text.Json;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace FindIT.E2E.Tests;

[TestFixture]
public class PerformanceBenchmarkTests
{
    private const double SearchTargetSeconds = 2.0;
    private const double PageTargetSeconds = 2.5;
    private const int SamplesPerCheck = 5;
    private readonly List<BenchmarkResult> results = [];

    [Test]
    public async Task SearchAndKeyPagesMeetPerformanceTargets()
    {
        var apiBaseUrl = Environment.GetEnvironmentVariable("PERFORMANCE_API_URL") ?? "http://localhost:8001";
        var frontendBaseUrl = Environment.GetEnvironmentVariable("PERFORMANCE_FRONTEND_URL") ?? "http://localhost:4200";

        try
        {
            await MeasureSearch(apiBaseUrl);
            MeasurePages(frontendBaseUrl);

            foreach (var result in results)
            {
                TestContext.Progress.WriteLine(
                    $"{result.Name}: median {result.MedianSeconds:F3}s; target < {result.TargetSeconds:F1}s; " +
                    $"samples [{string.Join(", ", result.SamplesSeconds.Select(value => value.ToString("F3")))}]");
                Assert.That(result.MedianSeconds, Is.LessThan(result.TargetSeconds), result.Name);
            }
        }
        finally
        {
            SaveReport(apiBaseUrl, frontendBaseUrl);
        }
    }

    private async Task MeasureSearch(string apiBaseUrl)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        var url = $"{apiBaseUrl.TrimEnd('/')}/api/v1/posts/query?q=benchmark";

        using (var warmup = await client.GetAsync(url))
        {
            Assert.That(warmup.StatusCode, Is.EqualTo(HttpStatusCode.OK), "Search warm-up request failed.");
        }

        var samples = new List<double>();
        for (var index = 0; index < SamplesPerCheck; index++)
        {
            var stopwatch = Stopwatch.StartNew();
            using var response = await client.GetAsync(url);
            stopwatch.Stop();

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), "Search request failed.");
            samples.Add(stopwatch.Elapsed.TotalSeconds);
        }

        results.Add(BenchmarkResult.Create("Search API q=benchmark", SearchTargetSeconds, samples));
    }

    private void MeasurePages(string frontendBaseUrl)
    {
        var options = new ChromeOptions();
        options.AddArgument("--headless=new");
        options.AddArgument("--disable-gpu");
        options.AddArgument("--no-sandbox");
        options.AddArgument("--disable-dev-shm-usage");

        using var driver = new ChromeDriver(options);
        driver.Manage().Timeouts().PageLoad = TimeSpan.FromSeconds(20);
        driver.ExecuteCdpCommand("Network.enable", new Dictionary<string, object>());
        driver.ExecuteCdpCommand("Network.setCacheDisabled", new Dictionary<string, object> { ["cacheDisabled"] = true });
        driver.ExecuteCdpCommand("Network.emulateNetworkConditions", new Dictionary<string, object>
        {
            ["offline"] = false,
            ["latency"] = 150,
            ["downloadThroughput"] = 200_000,
            ["uploadThroughput"] = 93_750,
            ["connectionType"] = "cellular4g",
        });

        foreach (var page in new[] { (Path: "/home", Name: "Home page"), (Path: "/items", Name: "Items page"), (Path: "/map", Name: "Map page") })
        {
            var samples = new List<double>();
            for (var index = 0; index < SamplesPerCheck; index++)
            {
                var stopwatch = Stopwatch.StartNew();
                driver.Navigate().GoToUrl($"{frontendBaseUrl.TrimEnd('/')}{page.Path}");

                var wait = new WebDriverWait(driver, TimeSpan.FromSeconds(15));
                wait.Until(browser =>
                    browser.FindElements(By.CssSelector("main .items-section")).Count > 0 &&
                    browser.FindElements(By.CssSelector(".spinner-border")).Count == 0 &&
                    (browser.FindElements(By.CssSelector("main app-item-card")).Count > 0 ||
                     browser.FindElements(By.CssSelector("main .empty-state, main .text-center.py-5, main .alert-danger")).Count > 0));
                stopwatch.Stop();
                samples.Add(stopwatch.Elapsed.TotalSeconds);
            }

            results.Add(BenchmarkResult.Create($"{page.Name} (simulated 4G, cache disabled)", PageTargetSeconds, samples));
        }
    }

    private void SaveReport(string apiBaseUrl, string frontendBaseUrl)
    {
        var reportPath = Environment.GetEnvironmentVariable("PERFORMANCE_REPORT_PATH")
            ?? Path.Combine("TestResults", "performance-results.json");
        var fullPath = Path.GetFullPath(reportPath);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        var report = new
        {
            generatedAtUtc = DateTimeOffset.UtcNow,
            apiBaseUrl,
            frontendBaseUrl,
            networkProfile = new { name = "Simulated 4G", latencyMs = 150, downloadBytesPerSecond = 200_000, uploadBytesPerSecond = 93_750 },
            samplesPerCheck = SamplesPerCheck,
            results,
        };

        File.WriteAllText(fullPath, JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
        TestContext.Progress.WriteLine($"Performance JSON report: {fullPath}");
    }

    private sealed record BenchmarkResult(string Name, double TargetSeconds, double MedianSeconds, IReadOnlyList<double> SamplesSeconds)
    {
        public static BenchmarkResult Create(string name, double targetSeconds, List<double> samples)
        {
            var sorted = samples.Order().ToArray();
            var median = sorted.Length % 2 == 0
                ? (sorted[sorted.Length / 2 - 1] + sorted[sorted.Length / 2]) / 2
                : sorted[sorted.Length / 2];

            return new BenchmarkResult(name, targetSeconds, median, samples);
        }
    }
}
