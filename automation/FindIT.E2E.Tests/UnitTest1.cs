
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

    [SetUp]
    public void SetUp()
    {
        driver = new ChromeDriver();
        driver.Manage().Window.Maximize();
    }

    [TearDown]
    public void TearDown()
    {
        try
        {
            // Save screenshot when a test fails
            if (TestContext.CurrentContext.Result
                .Outcome.Status == TestStatus.Failed)
            {
                string folder = Path.Combine(
                    TestContext.CurrentContext.WorkDirectory,
                    "TestScreenshots");

                Directory.CreateDirectory(folder);

                string fileName =
                    TestContext.CurrentContext.Test.MethodName
                    + "_" + DateTime.Now.ToString("yyyyMMdd_HHmmss")
                    + ".png";

                string path = Path.Combine(folder, fileName);

                var screenshot =
                    ((ITakesScreenshot)driver).GetScreenshot();

                File.WriteAllBytes(path, screenshot.AsByteArray);

                TestContext.WriteLine(
                    "Failure screenshot: " + path);
            }
        }
        finally
        {
            driver.Quit();
            driver.Dispose();
        }
    }

    // TEST 1 - Chrome browser smoke test
    [Test]
    public void ChromeBrowserStartsSuccessfully()
    {
        driver.Navigate().GoToUrl(
            "data:text/html,<title>FindIT Test</title>");

        Assert.That(driver.Title,
            Is.EqualTo("FindIT Test"));

        TestContext.WriteLine(
            "PASS: Chrome browser started successfully.");
    }

    // TEST 2 - FindIT homepage loading test
    [Test]
    public void FindITHomePageLoadsSuccessfully()
    {
        driver.Navigate().GoToUrl(BaseUrl);

        var wait = new WebDriverWait(
            driver, TimeSpan.FromSeconds(30));

        // Verify visible homepage content
        bool homeLoaded = wait.Until(d =>
        {
            string text = d.FindElement(
                By.TagName("body")).Text;

            return text.Contains(
                       "Find what",
                       StringComparison.OrdinalIgnoreCase)
                   &&
                   text.Contains(
                       "Recent items",
                       StringComparison.OrdinalIgnoreCase);
        });

        Assert.That(homeLoaded, Is.True,
            "FindIT homepage content was not displayed.");

        TestContext.WriteLine(
            "PASS: Homepage heading and recent items section visible.");
    }

    // TEST 3 - Recent items loading test
    [Test]
    public void RecentItemsLoadSuccessfully()
    {
        driver.Navigate().GoToUrl(BaseUrl);

        var wait = new WebDriverWait(
            driver, TimeSpan.FromSeconds(30));

        // Find visible item detail links or buttons
        By itemLocator = By.XPath(
            "//*[self::a or self::button]" +
            "[contains(normalize-space(.), 'View details')]");

        bool itemsLoaded = wait.Until(d =>
            d.FindElements(itemLocator)
             .Any(e => e.Displayed));

        Assert.That(itemsLoaded, Is.True,
            "Recent items were not displayed.");

        int itemCount = driver.FindElements(itemLocator)
            .Count(e => e.Displayed);

        TestContext.WriteLine(
            $"PASS: {itemCount} recent item links loaded.");
    }
}
