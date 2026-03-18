
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Trophy, X, TrendingUp, Sparkles } from 'lucide-react';

const INDIAN_NAMES = [
  "Aarav", "Vihaan", "Aditya", "Sai", "Arjun", "Reyansh", "Muhammad", "Rohan", "Krishna", "Ishaan",
  "Shaurya", "Atharv", "Kabir", "Ravi", "Amit", "Rajesh", "Vikram", "Sanjay", "Vijay", "Manoj",
  "Priya", "Diya", "Ananya", "Saanvi", "Aadya", "Kiara", "Myra", "Neha", "Pooja", "Sneha"
];

const INITIALS = ["S.", "K.", "M.", "A.", "R.", "J.", "P.", "D.", "V.", "G."];

const GAMES = [
  "Aviator X", "Wingo 1 Min", "Gwalior Day", "Gwalior Night", "Milan Day", 
  "Teen Patti", "Ludo Royale", "Dragon Tiger", "Coin Flip", "Plinko"
];

const MESSAGES = [
  "just won", "cashed out", "hit the jackpot of", "won a prize of", "withdrew"
];

interface ActivityItem {
  id: string;
  name: string;
  action: string;
  game: string;
  amount: number;
  time: string;
}

export const LiveActivityFeed: React.FC = () => {
  return null;
};
