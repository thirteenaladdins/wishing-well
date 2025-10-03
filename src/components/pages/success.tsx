import { CheckCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'

export default function Success() {
    const [searchParams] = useSearchParams()
    const [purchasedWishes, setPurchasedWishes] = useState(10) // Default to 10 wishes pack
    const sessionId = searchParams.get('session_id')

    useEffect(() => {
        // The webhook has already updated the database
        // We just need to show the user their new wish count
        if (sessionId) {
            setPurchasedWishes(10) // Show 10 wishes pack was purchased
        }
    }, [sessionId])

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center"
            >
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                </motion.div>
                <motion.h1 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-3xl font-bold text-gray-800 mb-4"
                >
                    Payment Successful!
                </motion.h1>
                <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-gray-600 mb-4"
                >
                    Thank you for your purchase! You now have {purchasedWishes} wishes available.
                </motion.p>
                <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-sm text-gray-500 mb-6"
                >
                    You can now make wishes and boost others' wishes.
                </motion.p>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                >
                    <Link 
                        to="/"
                        className="inline-block bg-green-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors duration-200"
                    >
                        Back to Wishing Well
                    </Link>
                </motion.div>
            </motion.div>
        </div>
    )
}