# pong-rn - Pong Game in React Native

A classic Pong game implemented with React Native. Challenge yourself in a single-player experience against an AI opponent.

## Features

- Classic Pong gameplay mechanics
- Single player mode against AI
- Touch controls for paddle movement
- Score tracking system
- Sound effects
- Win condition overlay
- Responsive design that adapts to screen size

## Getting Started

### Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js and npm installed
- React Native CLI setup
- Android SDK or iOS development environment (depending on your target platform)

### Installation

1. Clone the repository
```bash
git clone https://github.com/mike008/pong-rn.git
cd pong-rn
```

2. Install dependencies
```bash
npm install
```

### Running the Application

#### For Android
```bash
npx expo run:android --device
```

#### For iOS
```bash
npx expo run:ios --device
```

## Project Structure

```
pong-rn/
├── src/
│   ├── components/
│   │   ├── Ball.tsx
│   │   ├── Paddle.tsx
│   │   ├── ScoreBoard.tsx
│   │   └── WinOverlay.tsx
│   ├── constants/
│   │   └── game.ts
│   ├── screens/
│   │   └── GameScreen.tsx
│   └── types/
│       └── index.ts
├── assets/
│   ├── paddle_touch.mp3
│   └── ...
├── App.tsx
├── package.json
└── README.md
```

## How to Play

1. Launch the game on your device or emulator
2. Control your paddle by touching and dragging vertically on the screen
3. Try to return the ball past your opponent's paddle
4. First player to reach 7 points wins!

## Game Components

- **Ball**: The main game object that bounces around the court
- **Paddle**: Player-controlled paddles at each end of the court
- **ScoreBoard**: Displays current scores for both players
- **WinOverlay**: Shown when a player reaches the winning score

## Technologies Used

- React Native
- TypeScript
- Expo (if applicable based on app.json content)
