import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import useUserStore from "@/store/useUserStore";
import Navigation from "@/components/Navigation";
import { useCustomAlerts } from "@/hooks/useCustomAlerts";

interface ParsedTransaction {
  eventId: string;
  recipient: string;
  amount: string;
  type: 'purchase' | 'refund';
  description: string;
}

interface ParseResults {
  year: string;
  transactions: ParsedTransaction[];
  errors: string[];
}

export default function TransactionsPage() {
  const router = useRouter();
  const { user } = useUserStore();
  const { customAlert, AlertComponent } = useCustomAlerts();
  const [transactionText, setTransactionText] = useState('');
  const [parseResults, setParseResults] = useState<ParseResults | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveResults, setSaveResults] = useState<{
    savedPurchases: number;
    savedRefunds: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
  }, [user, router]);

  const parseTransactionData = (text: string): ParseResults => {
    const lines = text.split('\n');
    const results: ParseResults = {
      year: '',
      transactions: [],
      errors: []
    };

    // Use current year instead of dynamically detecting from data
    const currentYear = new Date().getFullYear().toString();
    results.year = currentYear;
    
    // Check if the data contains any transactions for the current year
    const currentYearPattern = `Gen Con Indy ${currentYear}`;
    if (!text.includes(currentYearPattern)) {
      results.errors.push(`No Gen Con ${currentYear} transactions found in the pasted data. Please make sure you're pasting current year transaction data.`);
      return results;
    }
    
    // Regex to match transaction lines for current year only - handle nested parentheses and tabs
    const transactionRegex = new RegExp(
      `Gen Con Indy ${currentYear} - Ticket (Purchase|Return) - ([A-Z0-9]+) \\((.+?)\\)\\t([^\\t]+)\\t\\$([0-9.]+)`,
      'g'
    );

    let match;
    while ((match = transactionRegex.exec(text)) !== null) {
      const [, type, eventId, description, recipient, amount] = match;
      
      results.transactions.push({
        eventId: eventId.trim(),
        recipient: recipient.trim(),
        amount: amount.trim(),
        type: type.toLowerCase() === 'purchase' ? 'purchase' : 'refund',
        description: description.trim()
      });
    }

    if (results.transactions.length === 0) {
      results.errors.push(`No Gen Con ${currentYear} transaction lines found. Please check the format of your pasted data and ensure it contains current year transactions.`);
    }

    return results;
  };

  const handleParseTransactions = async () => {
    if (!transactionText.trim()) {
      await customAlert('Please paste your transaction data first.', 'Missing Data');
      return;
    }

    const results = parseTransactionData(transactionText);
    setParseResults(results);
    setSaveResults(null); // Clear previous save results
    
    // Auto-save if parsing was successful and no errors
    if (results.transactions.length > 0 && results.errors.length === 0 && user) {
      setIsProcessing(true);
      
      try {
        const response = await fetch('/api/transactions/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            transactions: results.transactions,
            year: results.year
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to save transactions');
        }

        setSaveResults({
          savedPurchases: data.savedPurchases || 0,
          savedRefunds: data.savedRefunds || 0,
          errors: data.errors || []
        });

      } catch (error) {
        setSaveResults({
          savedPurchases: 0,
          savedRefunds: 0,
          errors: [error instanceof Error ? error.message : 'An error occurred']
        });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleSaveTransactions = async () => {
    if (!parseResults || !user) return;

    setIsProcessing(true);
    setSaveResults(null);

    try {
      const response = await fetch('/api/transactions/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          transactions: parseResults.transactions,
          year: parseResults.year
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save transactions');
      }

      setSaveResults({
        savedPurchases: data.savedPurchases || 0,
        savedRefunds: data.savedRefunds || 0,
        errors: data.errors || []
      });

    } catch (error) {
      setSaveResults({
        savedPurchases: 0,
        savedRefunds: 0,
        errors: [error instanceof Error ? error.message : 'An error occurred']
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setTransactionText('');
    setParseResults(null);
    setSaveResults(null);
  };

  const groupTransactionsByType = () => {
    if (!parseResults) return { purchases: [], refunds: [] };
    
    const purchases = parseResults.transactions.filter(t => t.type === 'purchase');
    const refunds = parseResults.transactions.filter(t => t.type === 'refund');
    
    return { purchases, refunds };
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const { purchases, refunds } = groupTransactionsByType();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation currentPage="transactions" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Transaction Parser
          </h2>
          <p className="text-gray-600 mb-4">
            Paste your GenCon transaction data below to automatically extract purchases and refunds. 
            You can get your transaction data from the{' '}
            <a 
              href="https://www.gencon.com/my_transactions/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              GenCon transactions page
            </a>.
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Paste Transaction Data
          </h3>
          
          <textarea
            value={transactionText}
            onChange={(e) => setTransactionText(e.target.value)}
            placeholder="Paste your GenCon transaction history here..."
            className="w-full h-64 px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          />

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleParseTransactions}
              disabled={!transactionText.trim() || isProcessing}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {isProcessing ? 'Processing & Saving...' : 'Parse & Save Transactions'}
            </button>
            
            <button
              onClick={handleClear}
              className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Parse Results */}
        {parseResults && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Parse Results
            </h3>

            {parseResults.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <h4 className="text-red-800 font-medium mb-2">Errors:</h4>
                <ul className="list-disc list-inside text-red-700 text-sm">
                  {parseResults.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {parseResults.year && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800">
                  <strong>GenCon Year:</strong> {parseResults.year}
                </p>
                <p className="text-blue-800">
                  <strong>Total Transactions:</strong> {parseResults.transactions.length}
                </p>
                <p className="text-blue-800">
                  <strong>Purchases:</strong> {purchases.length} | <strong>Refunds:</strong> {refunds.length}
                </p>
              </div>
            )}

            {/* Purchases */}
            {purchases.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                  💰 Purchases ({purchases.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Event ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Recipient
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {purchases.map((transaction, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                            {transaction.eventId}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {transaction.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {transaction.recipient}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                            ${transaction.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Refunds */}
            {refunds.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                  🔄 Refunds ({refunds.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Event ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Recipient
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {refunds.map((transaction, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                            {transaction.eventId}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {transaction.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {transaction.recipient}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                            ${transaction.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save Results */}
        {saveResults && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Save Results
            </h3>

            {saveResults.errors.length > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-red-800 font-medium mb-2">Errors occurred while saving:</h4>
                <ul className="list-disc list-inside text-red-700 text-sm">
                  {saveResults.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-green-800 font-medium mb-2">Successfully saved transactions!</h4>
                <div className="text-green-700 text-sm">
                  <p><strong>Purchases saved:</strong> {saveResults.savedPurchases}</p>
                  <p><strong>Refunds saved:</strong> {saveResults.savedRefunds}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* Custom Alert Component */}
      <AlertComponent />
    </div>
  );
}
