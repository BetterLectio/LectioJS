const Parser = new DOMParser({
  errorHandler: {
    warning: (msg) => {
      console.error(msg);
    },
    error: (msg) => {
      console.error(msg);
    },
    fatalError: (msg) => {
      console.error(msg);
    },
  },
});
const corsProxyURL = "https://cors.eu.org/";
const lectioURL = "https://www.lectio.dk/lectio/";

var lectioAPI = {
  getParseData: async function (x) {
    // Henter side fra lectio og Parserer siden
    var reqLink = [corsProxyURL, lectioURL, x].join("");
    console.log(reqLink);
    var response = await fetch(reqLink);
    return response.text();
  },
  getparsedData: async function (x) {
    var rawData = await this.getParseData(x);
    var filteredData = rawData.replace(/[\r\n\t]/gm, "");
    return Parser.parseFromString(filteredData, "text/html");
  },
  getInstList: async function () {
    var parsedInstData = await this.getparsedData("login_list.aspx");
    var instsUnparsed = parsedInstData.getElementById("schoolsdiv").childNodes;
    var instList = [];

    for (i = 0; i < instsUnparsed.length; i++) {
      try {
        var instURL = instsUnparsed[i].childNodes[0].getAttribute("href");
        var instName = instsUnparsed[i].textContent;

        var chop1 = instURL.substring(instURL.indexOf("/lectio/") + 8);
        var instId = chop1.substring(0, chop1.indexOf("/"));

        instList.push({
          id: instId,
          name: instName,
        });
      } catch (error) {
        console.error(error);
      }
    }
    return instList;
    // return {
    //   count: instList.length,
    //   instList: instList,
    // };
  },
  getInstData: async function (id) {
    // Giver JSON info om inst ud fra nummer
    var parsedInstData = await this.getparsedData(id);

    var filtered = parsedInstData
      .getElementById("m_masterleftDiv")
      .childNodes[0].textContent.trim();

    return {
      id: id,
      name: filtered,
      // name: parsedInstData.window.document.getElementById("m_masterleftDiv").textContent.trim()
    };
  },
  getLoginStatus: async function (id) {
    // Giver JSON info om login ud fra inst. nummer
    var parsedData = await this.getparsedData(`${id}/forside.aspx`);
    try {
      var username =
        parsedData.getElementsByClassName("ls-user-name")[0].textContent;

      var userLink = parsedData
        .getElementsByClassName("ls-user-name")[0]
        .getAttribute("href");
      var userId = userLink.substring(userLink.lastIndexOf("elevid=") + 7);

      // Find elev/l??rer id og type

      var userString = parsedData.getElementById(
        "s_m_HeaderContent_MainTitle"
      ).textContent;
      var userStringFiltered = userString.substring(
        0,
        userString.indexOf(" - Forside")
      );

      var userType;
      switch (
        userStringFiltered.substring(0, userStringFiltered.indexOf(" "))
      ) {
        case "Eleven":
          userType = 0;
          break;
        case "L??reren":
          userType = 1;
          break;
      }

      // Send tilbage

      return {
        loginStatus: 1,
        username: username,
        userId: userId,
        userType: userType,
        inst: id,
      };
    } catch (e) {
      return {
        loginStatus: 0,
        error: e,
        username: "",
      };
    }
  },
  getUserData: async function (id, userID, type) {
    // Giver brugerdata // id: instID, userID: brugerens id, type: (0 = elev, 1 = l??rer)
    var loginStatus = await this.getLoginStatus(id);

    if (loginStatus.loginStatus == 0) {
      return { error: "Ikke logget ind" };
    }

    var dataUrl;
    switch (type) {
      case 0:
        dataUrl = `${id}/SkemaNy.aspx?type=elev&elevid=${userID}`;
        break;
      case 1:
        dataUrl = `${id}/SkemaNy.aspx?type=laerer&laererid=${userID}`;
        break;
      default:
        return { error: "Bruger ikke fundet" };
    }

    var parsedData = await this.getparsedData(dataUrl);

    try {
      var userString = parsedData.getElementById(
        "s_m_HeaderContent_MainTitle"
      ).textContent;
    } catch (e) {
      return { error: "Bruger ikke fundet" };
    }
    var userPfpUrl =
      parsedData
        .getElementById("s_m_HeaderContent_picctrlthumbimage")
        .getAttribute("src") + "&fullsize=1";

    var userFullName;
    var userStringFiltered = userString.substring(
      0,
      userString.indexOf(" - Skema")
    );

    switch (userStringFiltered.substring(0, userStringFiltered.indexOf(" "))) {
      case "Eleven":
        var studentClass = userStringFiltered.substring(
          userStringFiltered.indexOf(",") + 2
        );
        userFullName = userStringFiltered.substring(
          7,
          userStringFiltered.indexOf(",")
        );

        return {
          userFullName: userFullName,
          userType: type,
          userPfpUrl: userPfpUrl,
          studentClass: studentClass,
        };
      case "L??reren":
        var teacherInit = userStringFiltered.substring(
          8,
          userStringFiltered.indexOf(" - ")
        );
        userFullName = userStringFiltered.substring(
          userStringFiltered.indexOf(" - ") + 3
        );

        return {
          userFullName: userFullName,
          userType: type,
          userPfpUrl: userPfpUrl,
          teacherInit: teacherInit,
        };
      default:
        return { error: "Bruger ikke fundet" };
    }

    return parsedData;
  },
  login: async function (id, username, password) {
    // Logger ind p?? Lectio
    // Get VIEWSTATE og EVENTVALIDATION (lectio sikkerhedskrav nederen)
    var parsedData = await this.getparsedData(`${id}/login.aspx`);

    var aspNet_VSX = parsedData
      .getElementById("__VIEWSTATEX")
      .getAttribute("value");
    var aspNet_EVV = parsedData
      .getElementById("__EVENTVALIDATION")
      .getAttribute("value");

    var data = {
      // ALLE felter her skal sendes til Lectio
      __EVENTTARGET: "m$Content$submitbtn2",
      __EVENTARGUMENT: "",
      __SCROLLPOSITION: "",
      __VIEWSTATEX: aspNet_VSX,
      __VIEWSTATEY_KEY: "",
      __VIEWSTATE: "",
      __EVENTVALIDATION: aspNet_EVV,
      m$Content$username: username,
      m$Content$password: password,
      masterfootervalue: "X1!??????",
      LectioPostbackId: "",
    };

    var formBody = [];
    for (var property in data) {
      var encodedKey = encodeURIComponent(property);
      var encodedValue = encodeURIComponent(data[property]);
      formBody.push(encodedKey + "=" + encodedValue);
    }
    formBody = formBody.join("&");

    await fetch(`${lectioURL}lectio/${id}/login.aspx`, {
      // Send post request med data
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody,
    });

    return await this.getLoginStatus(id);
  },
  logout: async function () {
    // Logger ud fra Lectio
    fetch(lectioURL + "1/logout.aspx");
    return await this.getLoginStatus();
  },
  getNavLinks: async function (url) {
    var response = await fetch(url);
    var rawData = await response.text();
    var parsedData = Parser.parseFromString(rawData, "text/html");

    var navLinks = [];
    try {
      var navArray =
        parsedData.getElementsByClassName("ls-subnav1")[0].childNodes;
    } catch (e) {
      return { error: "Ingen links fundet" };
    }

    for (i = 0; i < navArray.length; i++) {
      try {
        var navLink = navArray[i].childNodes[0].getAttribute("href");
        var navActive = navArray[i]
          .getAttribute("class")
          .includes("ls-subnav-active");
        var navName = navArray[i].textContent;

        navLinks.push({
          name: navName,
          href: navLink,
          active: navActive,
        });
      } catch (e) {}
    }

    if (navLinks.length == 0) {
      return { error: "Ingen links fundet" };
    }

    return {
      links: navLinks,
    };
  },
  setAspNetSID: async function (sid, expiry) {
    // S??tter ASP.NET SessionId. SessionId er forbundet til dit login, og bliver normalt slettet efter session.
    await browser.cookies.set({
      url: lectioURL,
      name: "ASP.NET_SessionId",
      value: sid,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
      expirationDate: expiry,
    });
    return await browser.cookies.get({
      url: lectioURL,
      name: "ASP.NET_SessionId",
    });
  },
  data: {
    getFrontPage: async function (id) {
      var loginStatus = await lectioAPI.getLoginStatus(id);

      if (loginStatus.loginStatus == 0) {
        return { error: "Ikke logget ind" };
      }

      var rawData = await lectioAPI.getParseData(`lectio/${id}/forside.aspx`);
      var parsedData = Parser.parseFromString(rawData, "text/html");

      var aktueltIs = parsedData.getElementById(
        "s_m_Content_Content_aktueltIsland_pa"
      );
      var undervisningIs = parsedData.getElementById(
        "s_m_Content_Content_undervisningIsland_pa"
      );
      var kommIs = parsedData.getElementById(
        "s_m_Content_Content_kommIsland_pa"
      );
      var skemaIs = parsedData.getElementById(
        "s_m_Content_Content_skemaIsland_pa"
      );

      // Parse aktuelt
      var importantInfo = parsedData.getElementById(
        "s_m_Content_Content_importantInfo"
      );
      var infoTable = importantInfo.getElementsByTagName("tr");
      var dashboard = [];

      for (i = 0; i < infoTable.length; i++) {
        dashboard.push(infoTable[i].getElementsByTagName("td")[1].textContent);
      }

      return {
        notices: {},
        dashboard: dashboard /*,
                education: undervisningIs,
                comms: kommIs,
                schedule: skemaIs*/,
      };
    },
  },
};
