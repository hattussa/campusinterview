const loginScreen = document.getElementById('login-screen');
const quizScreen = document.getElementById('quiz-screen');
const thankYouScreen = document.getElementById('thank-you-screen');
const loginForm = document.getElementById('login-form');
const fullNameInput = document.getElementById('full-name');
const rollNumberInput = document.getElementById('roll-number');
const departmentSelect = document.getElementById('department');
const startQuizButton = loginForm.querySelector('button[type="submit"]');
const questionElement = document.getElementById('question');
const optionsElement = document.getElementById('options');
const previousBtn = document.getElementById('previous-btn');
const nextBtn = document.getElementById('next-btn');
const questionNumberElement = document.getElementById('question-number');
const questionsRemainingElement = document.getElementById('questions-remaining');
const okButton = document.getElementById('ok-button');
const timeLeftElement = document.getElementById('time-left');

// Disable text selection, right-click, and DevTools
document.addEventListener('selectstart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
    e.preventDefault();
  }
});

// Handle visibility change events
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    alert('You switched tabs or minimized the window. The quiz will now restart.');
    window.location.reload();
  }
});

// Quiz Access Control Data from Google Sheets
async function fetchAccessControlData() {
  const webAppUrl = 'https://script.google.com/macros/s/AKfycbxYlXuF8Wa6UXbx2Cne_R84GHFgSqJIr7jHcuO9RQ4T8yuqX5FDonR5CrluseZ7dVdN/exec'; // Replace with your web app URL

  try {
    const response = await fetch(webAppUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch access control data');
    }
    const data = await response.json();
    console.log('Fetched access control data:', data); // Debugging
    return data;
  } catch (error) {
    console.error('Error fetching access control data:', error);
    alert('Failed to load access control data. Please try again.');
    return null;
  }
}

// Check access based on password, date range, and set timeLeft
async function checkAccess() {
  const accessData = await fetchAccessControlData();
  if (!accessData) return;

  const { password, startDate, endDate, timeLeft: sheetTimeLeft } = accessData;
  const currentDate = new Date();

  // Convert startDate and endDate to Date objects
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);

  // Check if the current date/time is within the allowed range
  if (currentDate < startDateObj || currentDate > endDateObj) {
    alert('This page is not available at the moment. Please check back later.');
    window.location.reload(); // Redirect to another page
    return;
  }

  // Prompt the user for a password
  const userPassword = prompt('Please enter the password to access this page:');

  // Debugging: Log the entered password and expected password
  console.log('Entered password:', userPassword);
  console.log('Expected password:', password);

  // Compare passwords
  if (userPassword == password) {
    alert('Access granted!');
  }

  if (userPassword !== password) {
    alert('Incorrect password. You do not have access to this page.');
    window.location.reload(); // Redirect to another page
    return;
  }

  // Set the timeLeft dynamically from the Google Sheet
  timeLeft = parseInt(sheetTimeLeft, 10); // Ensure it's a number
  console.log('Time left set to:', timeLeft);

  // If access is granted, proceed with the quiz
  console.log('Access granted!');
}

// Call the checkAccess function when the page loads
window.addEventListener('load', checkAccess);

let wakeLock = null;
let userDetails = {};
let currentQuestionIndex = 0;
let answers = [];
let quizData = [];
let timer;
let timeLeft = 0; // Will be set dynamically from Google Sheets
let isNavigatingFromReview = false; // Flag to track navigation from review screen

// Fetch departments from Google Sheets and populate the dropdown
function loadDepartments() {
  const webAppUrl = 'https://script.google.com/macros/s/AKfycbzsGlnzjvlwy0KNm5lxC2NMI4w4xpvVkjDvVsrJoYIDQLLJz0MFHOqrOHznQKlvwC_taA/exec'; // Replace with your web app URL

  fetch(webAppUrl)
    .then((response) => response.json())
    .then((data) => {
      const departmentDropdown = document.getElementById('department');
      // Clear existing options
      departmentDropdown.innerHTML = '';

      // Add options from fetched data
      data.forEach((dept) => {
        const option = document.createElement('option');
        option.value = dept.value;
        option.textContent = dept.name;
        departmentDropdown.appendChild(option);
      });
    })
    .catch((error) => {
      console.error('Error loading departments:', error);
    });
}

// Call the function to load departments when the page loads
window.addEventListener('load', loadDepartments);

// Function to request a wake lock
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake Lock is active');
    }
  } catch (err) {
    console.error('Failed to acquire wake lock:', err);
  }
}

// Function to release the wake lock
function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => {
      wakeLock = null;
      console.log('Wake Lock released');
    });
  }
}

// Request wake lock when the quiz starts
startQuizButton.addEventListener('click', () => {
  requestWakeLock();
});

// Release wake lock when the quiz ends
okButton.addEventListener('click', () => {
  releaseWakeLock();
});

// Function to shuffle an array using the Fisher-Yates algorithm
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // Random index from 0 to i
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array;
}

// Format time as HH:MM:SS
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Update the timer display
function updateTimer() {
  timeLeftElement.textContent = formatTime(timeLeft);
}

// Show the quiz alert modal when the quiz screen is loaded
function showQuizAlertModal() {
  const modal = document.getElementById('quiz-alert-modal');
  if (!modal) {
    console.error('Modal not found in the DOM');
    return;
  }
  modal.style.display = 'flex'; // Show the modal

  // Add event listener to the "Start Quiz" button
  const startQuizButton = document.getElementById('start-quiz-button');
  if (!startQuizButton) {
    console.error('Start Quiz button not found in the DOM');
    return;
  }
  startQuizButton.addEventListener('click', () => {
    modal.style.display = 'none'; // Hide the modal
    // Start the quiz logic here (e.g., start the timer, load the first question)
    startTimer();
    loadQuestion();
  });
}

// Call the function to show the modal when the quiz screen is loaded
quizScreen.addEventListener('load', showQuizAlertModal);

// Start the timer
function startTimer() {
  timer = setInterval(() => {
    timeLeft--;
    updateTimer();

    // End the quiz if time runs out
    if (timeLeft <= 0) {
      clearInterval(timer);
      alert('Time is up! The quiz will now submit.');
      quizScreen.classList.add('hidden');
      thankYouScreen.classList.remove('hidden');
    }
  }, 1000);
}

// Stop the timer
function stopTimer() {
  clearInterval(timer);
}

// Fetch questions from Google Sheet
async function fetchQuestions() {
  const webAppUrl = 'https://script.google.com/macros/s/AKfycby2lhuK4B_hE9vOHAkgZCFIlw_5cDSl84ic8JDWHL5dUaInQQy9UyhxTkc5G5FxydFi/exec'; // Replace with your Web App URL

  try {
    const response = await fetch(webAppUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch questions');
    }
    const data = await response.json();
    quizData = shuffleArray(data); // Shuffle the questions
  } catch (error) {
    console.error('Error fetching questions:', error);
    alert('Failed to load questions. Please try again.');
  }
}

// Login Form Submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  userDetails = {
    fullName: fullNameInput.value,
    rollNumber: rollNumberInput.value,
    department: departmentSelect.value
  };

  // Disable form fields and button
  fullNameInput.disabled = true;
  rollNumberInput.disabled = true;
  departmentSelect.disabled = true;
  startQuizButton.disabled = true;

  // Fetch and shuffle questions
  await fetchQuestions();

  // Switch to quiz screen
  loginScreen.classList.add('hidden');
  quizScreen.classList.remove('hidden');
  showQuizAlertModal(); // Show important rules
});

// Load Question
function loadQuestion() {
  const question = quizData[currentQuestionIndex];

  // Replace \n with <br> for proper line breaks in HTML
  const formattedQuestion = question.question.replace(/\n/g, '<br>');

  // Display the question with formatted code
  questionElement.innerHTML = formattedQuestion;

  // Display the options
  optionsElement.innerHTML = question.options.map((option, index) => `
    <label>
      <input type="radio" name="option" value="${option}" ${answers[currentQuestionIndex] === option ? 'checked' : ''}> ${option}
    </label><br>
  `).join('');

  // Update question number and total questions
  questionsRemainingElement.textContent = `Question ${currentQuestionIndex + 1} of ${quizData.length}`;

  // Add event listener to radio buttons
  const radioButtons = document.querySelectorAll('input[name="option"]');
  const optionLabels = document.querySelectorAll('#options label');

  radioButtons.forEach((radio, index) => {
    radio.addEventListener('change', (e) => {
      answers[currentQuestionIndex] = e.target.value; // Save the selected answer
      nextBtn.disabled = false; // Enable the Next button

      // Remove the selected-option class from all labels
      optionLabels.forEach(label => label.classList.remove('selected-option'));

      // Add the selected-option class to the selected label
      optionLabels[index].classList.add('selected-option');
    });

    // Highlight the selected option if it was previously selected
    if (radio.checked) {
      optionLabels[index].classList.add('selected-option');
    }
  });

  updateButtons();
}

// Show Review Screen
function showReviewScreen() {
  console.log('Showing review screen...'); // Debugging
  const reviewScreen = document.getElementById('review-screen');
  const reviewQuestionsContainer = document.getElementById('review-questions-container');
  const submitReviewButton = document.getElementById('submit-review-button');

  if (!reviewScreen || !reviewQuestionsContainer || !submitReviewButton) {
    console.error('One or more elements for the review screen are missing!');
    return;
  }

  // Clear the review questions container
  reviewQuestionsContainer.innerHTML = '';

  // Create a grid of question numbers
  quizData.forEach((question, index) => {
    const questionNumberButton = document.createElement('button');
    questionNumberButton.textContent = index + 1;
    questionNumberButton.classList.add('question-number-button');
    if (answers[index]) {
      questionNumberButton.classList.add('answered');
    } else {
      questionNumberButton.classList.add('unanswered');
    }

    // Add event listener to navigate to the selected question
    questionNumberButton.addEventListener('click', () => {
      isNavigatingFromReview = true; // Set the flag to true
      currentQuestionIndex = index;
      quizScreen.classList.remove('hidden');
      reviewScreen.classList.add('hidden');
      loadQuestion();
    });

    reviewQuestionsContainer.appendChild(questionNumberButton);
  });

  // Show the review screen
  quizScreen.classList.add('hidden');
  reviewScreen.classList.remove('hidden');

  // Add event listener to the submit button in the review screen
  submitReviewButton.addEventListener('click', () => {
    quizScreen.classList.add('hidden');
    reviewScreen.classList.add('hidden');
    thankYouScreen.classList.remove('hidden');
  });
}

// Update Buttons
function updateButtons() {
  previousBtn.disabled = currentQuestionIndex === 0;
  nextBtn.disabled = false; // Always enable the Next button after the first question

  if (isNavigatingFromReview || currentQuestionIndex === quizData.length - 1) {
    nextBtn.textContent = 'Review';
  } else {
    nextBtn.textContent = 'Next';
  }
}

// Event Listeners for Buttons
previousBtn.addEventListener('click', () => {
  currentQuestionIndex--;
  loadQuestion();
});

nextBtn.addEventListener('click', () => {
  if (currentQuestionIndex === quizData.length - 1 || isNavigatingFromReview) {
    isNavigatingFromReview = false; // Reset the flag
    showReviewScreen();
  } else {
    currentQuestionIndex++;
    loadQuestion();
  }
});

// OK Button Click
okButton.addEventListener('click', () => {
  const score = answers.filter((answer, index) => answer === quizData[index].answer).length;
  const currentDate = new Date().toLocaleString(); // Get current date and time
  const data = {
    ...userDetails,
    score,
    submissionDate: currentDate, // Add submission date and time
    ...calculateCategoryScores() // Include category scores
  };
  submitToGoogleSheet(data);
});

// Function to calculate the score for each category
function calculateCategoryScores() {
  const categoryScores = {};

  quizData.forEach((question, index) => {
    const category = question.category;
    if (!categoryScores[category]) {
      categoryScores[category] = 0;
    }
    if (answers[index] === question.answer) {
      categoryScores[category]++;
    }
  });

  return categoryScores;
}

// Google Sheets Integration
function submitToGoogleSheet(data) {
  const scriptURL = 'https://script.google.com/macros/s/AKfycbxDFiribd_RYyLImyyctdoBdtYSoRdO20A1AHDqtedT8HpKp6W2PsTckqwD8a4h5LuBWw/exec';

  // Add data as query parameters
  const params = new URLSearchParams({
    rollNumber: data.rollNumber,
    fullName: data.fullName,
    department: data.department,
    score: data.score,
    submissionDate: data.submissionDate,
    ...calculateCategoryScores()
  });

  const urlWithParams = `${scriptURL}?${params.toString()}`;

  fetch(urlWithParams, {
    method: 'GET',
    mode: 'no-cors',
    redirect: 'follow'
  })
    .then(response => {
        alert('Result submitted successfully!');
        window.location.reload();
    })
    .catch(error => {
      console.error('Error:', error);
      alert('Failed to submit result. Please try again.');
    });
}

// Update the year dynamically
document.getElementById('current-year').textContent = new Date().getFullYear();