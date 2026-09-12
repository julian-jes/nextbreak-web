const state = {
    currentPageIndex: 0,
    pageCount: 0,
    pagerControlsInitialized: false
};

const dom = {
    appContainer: document.getElementById("app-container"),
    loadingScreen: document.getElementById("loading-screen"),
    app: document.getElementById("app"),
    summerScreen: document.getElementById("summer-screen"),
    errorScreen: document.getElementById("error-screen"),
    statusText: document.getElementById("status-text"),
    nextDayOff: document.getElementById("next-day-off"),
    schoolDaysLeft: document.getElementById("school-days-left"),
    pagerTrack: document.getElementById("pager-track"),
    progressBarFill: document.getElementById("progress-bar-fill"),
    progressBarLabel: document.getElementById("progress-bar-label"),
    pager: document.getElementById("pager"),
    pillsContainer: document.getElementById("pager-pills"),
    prevButton: document.getElementById("pager-prev"),
    nextButton: document.getElementById("pager-next"),

    pills: []
};

async function loadData() {
    const fontsReady = document.fonts.ready;

    try {
        const fetchPromises = Promise.all([
            fetch("https://julian-jes.github.io/nextbreak-data/data.json").then(res => res.json()),
            fetch("https://julian-jes.github.io/nextbreak-data/version.json").then(res => res.json())
        ]);

        const [[calendarData, version]] = await Promise.all([fetchPromises, fontsReady]);

        const viewModel = buildViewModel(calendarData, version);
        render(viewModel);
    } catch (err) {
        console.error(err);
        render({ state : "error" });
    }

    hideLoadingScreen();
}

function hideLoadingScreen() {
    dom.appContainer.hidden = false;

    dom.loadingScreen.classList.add("hidden");
    dom.loadingScreen.addEventListener("transitionend", () => {
        dom.loadingScreen.remove();
    }, { once: true });
}

function render(viewModel) {
    dom.app.hidden = viewModel.state !== "normal";
    dom.summerScreen.hidden = viewModel.state !== "summer";
    dom.errorScreen.hidden = viewModel.state !== "error";

    if(viewModel.state !== "normal") {
        dom.statusText.textContent = "";
        return;
    }

    dom.statusText.textContent = viewModel.statusText;
    dom.nextDayOff.textContent = viewModel.nextDayOffText;
    dom.schoolDaysLeft.textContent = viewModel.schoolDaysLeftText;

    dom.pagerTrack.innerHTML = "";

    viewModel.pages.forEach(page => {
        const pageDiv = document.createElement("div");
        pageDiv.classList.add("pager-page");

        const number = document.createElement("p");
        number.classList.add("holiday-countdown");
        number.textContent = page.number;

        const label = document.createElement("p");
        label.classList.add("holiday-label");
        label.innerHTML = page.text;

        pageDiv.appendChild(number);
        pageDiv.appendChild(label);
        dom.pagerTrack.appendChild(pageDiv);
   });
   
   state.pageCount = viewModel.pages.length;
   state.currentPageIndex = 0;
   setupPager();

    const percent = Math.floor(viewModel.progress * 100);
    dom.progressBarFill.style.width = `${percent}%`;
    dom.progressBarLabel.textContent = `${percent}%`;
}

function buildViewModel(calendarData, version) {

    if(isCalendarTooOld(version)) {
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

    const pages = [];

    if(holiday) {
        pages.push({
            number: "",
            text: `Enjoy your ${holidayName(holidayIndex - 1)} break!`
        });
    }
    for (let i = holidayIndex; i < 5; i++) {
        const count = daysUntilHolidays(calendarData, i);
        const unit = count === 1 ? "day" : "days";
        pages.push({
            number: String(count),
            text: `school ${unit} until\n${holidayName(i)} break`
        });
    }

    const daysLeft = schoolDaysLeft(calendarData);
    let schoolDaysLeftText;
    let statusText;
    if(daysLeft === 1) {
        schoolDaysLeftText = "1 school day left";
        statusText = "War is over.";
    } else {
        schoolDaysLeftText = `${daysLeft} school days left`;
        statusText = "";
    }

    return {
        state: "normal",
        statusText,
        pages,
        nextDayOffText,
        schoolDaysLeftText,
        progress: schoolYearProgress(calendarData)
    };
}

//pager logic

function setupPager() {

    dom.pillsContainer.innerHTML = "";
    dom.pills = [];
    for (let i = 0; i < state.pageCount; i++) {
        const pill = document.createElement("button");
        pill.classList.add("pill");
        pill.innerHTML = `<span class="pill-dot"></span>`
        pill.setAttribute("aria-label", `Go to page ${i + 1}`);
        pill.addEventListener("click", () => goToPage(i));

        dom.pillsContainer.appendChild(pill);
        dom.pills.push(pill);
    }

    updatePagerUI(false);

    if(state.pagerControlsInitialized) return;
    state.pagerControlsInitialized = true;

    dom.prevButton.addEventListener("click", () => goToPage(state.currentPageIndex - 1));
    dom.nextButton.addEventListener("click", () => goToPage(state.currentPageIndex + 1));

    setupDrag(dom.pager);
    setupKeyboard(dom.pager);
}

function goToPage(index) {
    state.currentPageIndex = Math.max(0, Math.min(state.pageCount - 1, index));
    updatePagerUI(true);
}

function updatePagerUI(animate) {
    if(!dom.pagerTrack) return;

    dom.pagerTrack.style.transition = animate ? "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)" : "none";
    dom.pagerTrack.style.transform = `translateX(-${state.currentPageIndex * 100}%)`

    dom.pills.forEach((pill, i) => {
        pill.classList.toggle("active", i === state.currentPageIndex);
    });

    dom.prevButton.disabled = state.currentPageIndex === 0;
    dom.nextButton.disabled = state.currentPageIndex === state.pageCount - 1;
}

function setupDrag(pager) {
    let dragging = false;
    let startX = 0;
    let pagerWidth = 0;

    pager.addEventListener("pointerdown", (e) => {
        if(e.pointerType === "mouse") return;
        if(state.pageCount <= 1) return;
        dragging = true;
        startX = e.clientX;
        pagerWidth = pager.clientWidth;
        dom.pagerTrack.style.transition = "none";
        pager.setPointerCapture(e.pointerId);
    });

    pager.addEventListener("pointermove", (e) => {
        if(!dragging) return;
        let deltaX = e.clientX - startX;

        if((state.currentPageIndex === 0 && deltaX > 0) || (state.currentPageIndex === state.pageCount - 1 && deltaX < 0)) {
            deltaX *= 0.35;
        }

        const translatePx = -state.currentPageIndex * pagerWidth + deltaX;
        dom.pagerTrack.style.transform = `translateX(${translatePx}px)`;
    });

    function endDrag(e) {
        if(!dragging) return;
        dragging = false;

        const deltaX = e.clientX - startX;
        const threshold = pagerWidth * 0.2;

        if(deltaX < -threshold && state.currentPageIndex < state.pageCount - 1) {
            state.currentPageIndex++;
        } else if(deltaX > threshold && state.currentPageIndex > 0) {
            state.currentPageIndex--;
        }
        updatePagerUI(true);
    }

    pager.addEventListener("pointercancel", endDrag);
    pager.addEventListener("pointerup", endDrag);
}

function setupKeyboard(pager) {
    document.addEventListener("keydown", (e) => {
        if(e.key === "ArrowLeft") {
            goToPage(state.currentPageIndex - 1);
        } else if(e.key === "ArrowRight") {
            goToPage(state.currentPageIndex + 1);
        }
    });
}

//calendar logic

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