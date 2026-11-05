
using NUnit.Framework;
using OpenQA.Selenium.Chrome;

namespace FindIT.E2E.Tests;

[TestFixture]
public class BrowserSmokeTest
{
    [Test]
    public void ChromeBrowserStartsSuccessfully()
    {
        using var driver = new ChromeDriver();

        driver.Navigate().GoToUrl(
            "data:text/html,<title>FindIT Test</title>"
        );

        Assert.That(driver.Title,
            Is.EqualTo("FindIT Test"));
    }
}
