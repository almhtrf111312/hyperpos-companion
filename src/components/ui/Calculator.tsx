import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface CalculatorProps {
    isOpen: boolean;
    onClose: () => void;
    onResult?: (value: number) => void;
    className?: string;
}

export function Calculator({ isOpen, onClose, onResult, className }: CalculatorProps) {
    const [display, setDisplay] = useState('0');
    const [previousValue, setPreviousValue] = useState<number | null>(null);
    const [operator, setOperator] = useState<string | null>(null);
    const [waitingForOperand, setWaitingForOperand] = useState(false);

    const buttons = [
        'C', '±', '%', '÷',
        '7', '8', '9', '×',
        '4', '5', '6', '-',
        '1', '2', '3', '+',
        '0', '.', '=', '✓'
    ];

    const inputDigit = useCallback((digit: string) => {
        if (waitingForOperand) {
            setDisplay(digit);
            setWaitingForOperand(false);
        } else {
            setDisplay(display === '0' ? digit : display + digit);
        }
    }, [display, waitingForOperand]);

    const inputDecimal = useCallback(() => {
        if (waitingForOperand) {
            setDisplay('0.');
            setWaitingForOperand(false);
        } else if (!display.includes('.')) {
            setDisplay(display + '.');
        }
    }, [display, waitingForOperand]);

    const clear = useCallback(() => {
        setDisplay('0');
        setPreviousValue(null);
        setOperator(null);
        setWaitingForOperand(false);
    }, []);

    const toggleSign = useCallback(() => {
        const value = parseFloat(display);
        setDisplay(String(-value));
    }, [display]);

    const inputPercent = useCallback(() => {
        const value = parseFloat(display);
        setDisplay(String(value / 100));
    }, [display]);

    const performOperation = useCallback((nextOperator: string) => {
        const inputValue = parseFloat(display);

        if (previousValue === null) {
            setPreviousValue(inputValue);
        } else if (operator) {
            const result = calculate(previousValue, inputValue, operator);
            setDisplay(String(result));
            setPreviousValue(result);
        }

        setWaitingForOperand(true);
        setOperator(nextOperator);
    }, [display, previousValue, operator]);

    const calculate = (prev: number, next: number, op: string): number => {
        switch (op) {
            case '+': return prev + next;
            case '-': return prev - next;
            case '×': return prev * next;
            case '÷': return next !== 0 ? prev / next : 0;
            default: return next;
        }
    };

    const equals = useCallback(() => {
        if (!operator || previousValue === null) return;

        const inputValue = parseFloat(display);
        const result = calculate(previousValue, inputValue, operator);

        setDisplay(String(Math.round(result * 100) / 100)); // Round to 2 decimals
        setPreviousValue(null);
        setOperator(null);
        setWaitingForOperand(true);
    }, [display, previousValue, operator]);

    const handleConfirm = useCallback(() => {
        const value = parseFloat(display);
        if (!isNaN(value) && onResult) {
            onResult(value);
        }
        onClose();
    }, [display, onResult, onClose]);

    const handleButton = useCallback((btn: string) => {
        switch (btn) {
            case 'C': clear(); break;
            case '±': toggleSign(); break;
            case '%': inputPercent(); break;
            case '.': inputDecimal(); break;
            case '=': equals(); break;
            case '✓': handleConfirm(); break;
            case '+':
            case '-':
            case '×':
            case '÷':
                performOperation(btn);
                break;
            default:
                inputDigit(btn);
        }
    }, [clear, toggleSign, inputPercent, inputDecimal, equals, handleConfirm, performOperation, inputDigit]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className={cn(
                "bg-card rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden",
                className
            )}>
                {/* Display */}
                <div className="bg-muted p-4">
                    <div className="text-right text-3xl font-mono text-foreground min-h-[48px] overflow-hidden">
                        {display}
                    </div>
                </div>

                {/* Buttons */}
                <div className="grid grid-cols-4 gap-1 p-2">
                    {buttons.map((btn, index) => {
                        const isOperator = ['+', '-', '×', '÷', '='].includes(btn);
                        const isSpecial = ['C', '±', '%'].includes(btn);
                        const isConfirm = btn === '✓';
                        const isZero = btn === '0';

                        return (
                            <button
                                key={index}
                                onClick={() => handleButton(btn)}
                                className={cn(
                                    "h-14 rounded-xl text-xl font-semibold transition-all active:scale-95",
                                    isConfirm && "bg-green-500 text-white hover:bg-green-600",
                                    isOperator && !isConfirm && "bg-primary text-primary-foreground hover:bg-primary/90",
                                    isSpecial && "bg-muted-foreground/20 text-foreground hover:bg-muted-foreground/30",
                                    !isOperator && !isSpecial && !isConfirm && "bg-muted text-foreground hover:bg-muted/80",
                                    isZero && "col-span-1"
                                )}
                            >
                                {btn}
                            </button>
                        );
                    })}
                </div>

                {/* Close button */}
                <button
                    onClick={onClose}
                    className="w-full py-3 text-muted-foreground hover:text-foreground transition-colors border-t border-border"
                >
                    إغلاق
                </button>
            </div>
        </div>
    );
}

export default Calculator;
