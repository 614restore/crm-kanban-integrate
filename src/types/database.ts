// src/types/database.ts

// Interface for weather_history table
export interface WeatherHistory {
    id: number;
    date: string;
    temperature: number;
    humidity: number;
    location: string;
}

// Interface for labor_entries table
export interface LaborEntry {
    id: number;
    employeeId: number;
    date: string;
    hoursWorked: number;
    jobDescription: string;
}

// Interface for subcontractor_payments table
export interface SubcontractorPayment {
    id: number;
    subcontractorId: number;
    amount: number;
    date: string;
    description: string;
}

// Interface for estimate_items table
export interface EstimateItem {
    id: number;
    estimateId: number;
    description: string;
    quantity: number;
    unitPrice: number;
}