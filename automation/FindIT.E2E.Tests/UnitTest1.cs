
using System;
using System.IO;
using System.Linq;
using NUnit.Framework;
using NUnit.Framework.Interfaces;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;

namespace FindIT.E2E.Tests;

[TestFixture]
public class BrowserSmokeTest
{
    private ChromeDriver driver = null!;

    private const string BaseUrl =
        "http://lostandfound.northeurope.cloudapp.azure.com/home";

    // Open Chrome before every test
    [SetUp]
    public void SetUp()
    {
        driver = new ChromeDriver();
        driver.Manage().Window.Maximize();
    }

    // Save screenshot on failure and close Chrome
    [TearDown]
    public void TearDown()
    {
        try
        {
            if (driver != null &&
                TestContext.CurrentContext.Result.Outcome.Status
                    == TestStatus.Failed)
            {
                try
                {
                    string folder = Path.Combine(
                        TestContext.CurrentContext.WorkDirectory,
                        "TestScreenshots");

                    Directory.CreateDirectory(folder);

                    string testName =
                        TestContext.CurrentContext.Test.MethodName
                        ?? "UnknownTest";

                    string fileName =
                        testName + "_" +
                        DateTime.Now.ToString("yyyyMMdd_HHmmss") +
                        ".png";

                    string path = Path.Combine(folder, fileName);

                    var screenshot =
                        ((ITakesScreenshot)driver).GetScreenshot();

                    File.WriteAllBytes(
                        path, screenshot.AsByteArray);

                    TestContext.AddTestAttachment(
                        path, "Failure screenshot");

                    TestContext.WriteLine(
                        "Screenshot saved: " + path);
                }
                catch (Exception ex)
                {
                    TestContext.WriteLine(
                        "Screenshot failed: " + ex.Message);
                }
            }
        }
        finally
        {
            if (driver != null)
            {
                try
                {
                    driver.Quit();
                }
                finally
                {
                    driver.Dispose();
                }
            }
        }
    }

    // TEST 1: Chrome browser startup
    [Test]
    public void ChromeBrowserStartsSuccessfully()
    {
        driver.Navigate().GoToUrl(
            "data:text/html,<title>FindIT Test</title>");

        Assert.That(
            driver.Title,
            Is.EqualTo("FindIT Test"));

        TestContext.WriteLine(
            "PASS: Chrome browser started successfully.");
    }

    // TEST 2: Verify FindIT homepage
    [Test]
    public void FindITHomePageLoadsSuccessfully()
    {
        driver.Navigate().GoToUrl(BaseUrl);

        var wait = new WebDriverWait(
            driver, TimeSpan.FromSeconds(30));

        bool homeLoaded = wait.Until(d =>
        {
            string pageText =
                d.FindElement(By.TagName("body")).Text;

            return pageText.Contains(
                       "Find what",
                       StringComparison.OrdinalIgnoreCase)
                &&
                   pageText.Contains(
                       "Recent items",
                       StringComparison.OrdinalIgnoreCase);
        });

        Assert.That(
            homeLoaded,
            Is.True,
            "FindIT homepage content was not displayed.");

        TestContext.WriteLine(
            "PASS: FindIT homepage loaded successfully.");
    }

    // TEST 3: Verify recent items load
    [Test]
    public void RecentItemsLoadSuccessfully()
    {
        driver.Navigate().GoToUrl(BaseUrl);

        var wait = new WebDriverWait(
            driver, TimeSpan.FromSeconds(30));

        By itemLocator = By.XPath(
            "//*[self::a or self::button]" +
            "[contains(normalize-space(.), 'View details')]");

        bool itemsLoaded = wait.Until(d =>
            d.FindElements(itemLocator)
             .Any(element => element.Displayed));

        Assert.That(
            itemsLoaded,
            Is.True,
            "No recent item cards were displayed.");

        int itemCount = driver
            .FindElements(itemLocator)
            .Count(element => element.Displayed);

        Assert.That(
            itemCount,
            Is.GreaterThan(0));

        TestContext.WriteLine(
            $"PASS: {itemCount} recent items loaded.");
    }
}
