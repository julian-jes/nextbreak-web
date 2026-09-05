async function loadData() {
    const dataResponse = await fetch("https://julian-jes.github.io/nextbreak-data/data.json");
    const calendarData = await dataResponse.json();

    const versionResponse = await fetch("https://julian-jes.github.io/nextbreak-data/version.json");
    const version = await versionResponse.json();

    const viewModel = buildViewModel(calendarData, version);
    console.log(viewModel);
    render(viewModel);
}

function render(viewModel) {
    document.getElementById("app").hidden = viewModel.state !== "normal";
    document.getElementById("summer-screen").hidden = viewModel.state !== "summer";
    document.getElementById("error-screen").hidden = viewModel.state !== "error";

    if(viewModel.state !== "normal") {
        return;
    }

    document.getElementById("status-text").textContent = viewModel.statusText;
    document.getElementById("holiday-countdown").textContent = viewModel.daysNumber;
    document.getElementById("holiday-label").textContent = viewModel.daysText;
    document.getElementById("next-day-off").textContent = viewModel.nextDayOff;
    document.getElementById("school-days-left").textContent = viewModel.schoolDaysLefText;

    const percent = Math.floor(viewModel.progress * 100);
    document.getElementById("progress-bar-fill").style.width = `${percent}%`;
    document.getElementById("progress-bar-label").textContent = `${percent}%`;
}

function buildViewModel(calendarData, version) {

    if(isCalendarTooOld(version)) {
        console.log("Test");
        return { state: "error"};
    }

    if(isSummerHoliday(calendarData, version)) {
        return { state: "summer"};
    }

    const nextDayOff = daysUntilNextDayOff(calendarData);
    let nextDayOffText;
    if(nextDayOff === 0) {
        nextDayOffText = "No school today!";
    } else if(nextDayOff === 1) {
        nextDayOffText = "Next day off in 1 day";
    } else {
        nextDayOffText = `Next day off in ${nextDayOff} days`;
    }

    const holiday = isHoliday(calendarData);
    const holidayIndex = nextHolidayIndex(calendarData);

    let daysNumber;
    let daysText;
    if(holiday) {
        daysNumber = "";
        daysText = `Enjoy your ${holidayName(holidayIndex - 1)} break!`
    } else {
        const count = daysUntilHolidays(calendarData, holidayIndex);
        const unit = count === 1 ? "day" : "days";
        daysNumber = String(count);
        daysText = `school ${unit} until\n${holidayName(holidayIndex)} break`
    }

    const daysLeft = schoolDaysLeft(calendarData);
    let schoolDaysLefText;
    let statusText;
    if(daysLeft == 1) {
        schoolDaysLefText = "1 school day left";
        statusText = "War is over.";
    } else {
        schoolDaysLefText = `${daysLeft} school days left`;
        statusText = "";
    }

    return {
        state: "normal",
        statusText,
        daysNumber,
        daysText,
        nextDayOffText,
        schoolDaysLefText,
        progress: schoolYearProgress(calendarData)
    };
}


function isCalendarTooOld(version) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    return currentMonth >= 9 && currentYear > version.year;
}

function isSummerHoliday(calendarData, version) {
    const today = getCurrentDate();
    const currentYear = new Date().getFullYear();
    const firstDay = calendarData.calendar[0].date;
    const lastDay = calendarData.calendar[calendarData.calendar.length - 1].date;

    if(version.year >= currentYear) {
        return today < firstDay;
    }

    if(today < lastDay) {
        return false;
    }

    if(today === lastDay) {
        const now = new Date();
        const [hours, minutes] = calendarData.summer_start_time.split(":");
        const endTime = new Date();
        endTime.setHours(Number(hours), Number(minutes), 0, 0);

        return now >= endTime;
    }

    return true;
}

function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return "2026-09-07";
    return `${year}-${month}-${day}`
}

function currentDayIndex(calendarData) {
    const currentDate = getCurrentDate();
    return calendarData.calendar.findIndex(day => day.date === currentDate);
}

function nextHolidayIndex(calendarData) {
    const currentDate = getCurrentDate();

    if(currentDate < calendarData.autumn_break_start) return 0;
    if(currentDate < calendarData.winter_break_start) return 1;
    if(currentDate < calendarData.carnival_break_start) return 2;
    if(currentDate < calendarData.easter_break_start) return 3;

    return 4;
}

function holidayName(holidayIndex) {
    switch(holidayIndex) {
        case 0: return "autumn";
        case 1: return "winter";
        case 2: return "carnival";
        case 3: return "easter";
        default: return "summer";
    }
}

function daysUntilHolidays(calendarData, holidayIndex) {
    const startIndex = currentDayIndex(calendarData)
    const holidayStart = holidayStartOfIndex(calendarData, holidayIndex);
    let days = 0;

    for(let i = startIndex; i < calendarData.calendar.length; i++) {
        if(calendarData.calendar[i].date === holidayStart) {
            break;
        }
        if(!calendarData.calendar[i].is_school_day) {
            continue;
        }
        days++;
    }

    return days;
}

function schoolDaysLeft(calendarData) {
    const startIndex = currentDayIndex(calendarData);
    const summerStart = summerBreakStart(calendarData);
    let days = 0;

    for(let i = startIndex; i < calendarData.calendar.length; i++)
    {
        if(calendarData.calendar[i].date === summerStart) {
            break;
        }
        if(!calendarData.calendar[i].is_school_day) {
            continue;
        }
        days++;
    }

    return days;
}

function daysUntilNextDayOff(calendarData) {
    const startIndex = currentDayIndex(calendarData);
    let days = 0;

    for(let i = startIndex; i < calendarData.calendar.length; i++) {
        if(!calendarData.calendar[i].is_school_day) {
            break;
        }
        days++;
    }

    return days;
}

function holidayStartOfIndex(calendarData, holidayIndex) {
    switch(holidayIndex) {
        case 0: return calendarData.autumn_break_start;
        case 1: return calendarData.winter_break_start;
        case 2: return calendarData.carnival_break_start;
        case 3: return calendarData.easter_break_start;
        default: return summerBreakStart(calendarData);
    }
}

function summerBreakStart(calendarData) {
    const lastSchoolDay = calendarData.calendar[calendarData.calendar.length - 1].date;
    const date = new Date(lastSchoolDay + "T00:00:00");
    date.setDate(date.getDate() + 1);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`
}

function schoolYearProgress(calendarData) {
    let totalSchoolDays = 0;

    for(const day of calendarData.calendar) {
        if(day.is_school_day) {
            totalSchoolDays++;
        }
    }

    return 1 - schoolDaysLeft(calendarData) / totalSchoolDays;
}

function isHoliday(calendarData) {
    const holidayIndex = nextHolidayIndex(calendarData) - 1;
    const currentIndex = currentDayIndex(calendarData);

    if(holidayIndex === -1) {
        return false;
    }

    const holidayStart = holidayStartOfIndex(calendarData, holidayIndex);
    const startIndex = calendarData.calendar.findIndex(day => day.date === holidayStart);

    for(let i = startIndex; i <= currentIndex; i++) {
        if(calendarData.calendar[i].is_school_day) {
            return false;
        }
    }

    return true;
}

loadData();