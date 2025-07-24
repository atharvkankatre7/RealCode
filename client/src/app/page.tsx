"use client"

import { useRouter } from "next/navigation"
import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { useInView } from "react-intersection-observer"
import Link from "next/link"
import { FiCode, FiUsers, FiLock, FiGlobe, FiArrowRight, FiGithub } from "react-icons/fi"

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
}

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => {
  return (
    <motion.div
      className="card p-6 flex flex-col items-center text-center"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={fadeIn}
    >
      <div className="text-4xl mb-4 text-blue-500">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-300">{description}</p>
    </motion.div>
  )
}

// Simple code block component
const CodeBlock = () => {
  return (
    <motion.div
      className="bg-zinc-900 rounded-xl p-6 text-gray-300 font-mono text-sm overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="flex items-center text-gray-500 mb-4">
        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
        <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
        <span className="ml-2">collaborative-code.js</span>
      </div>
      <div className="text-purple-400">// Real-time collaborative code editor</div>
      <div className="text-blue-400">// Start coding with your team...</div>
    </motion.div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const { scrollYProgress } = useScroll()
  const heroRef = useRef(null)
  const { ref: inViewRef, inView: isHeroInView } = useInView({ threshold: 0.1 })

  // Combine refs
  const setRefs = (el: any) => {
    // For react-intersection-observer
    inViewRef(el)
    // For heroRef
    if (heroRef) {
      // @ts-ignore
      heroRef.current = el
    }
  }

  // Parallax effect
  const y = useTransform(scrollYProgress, [0, 1], [0, -300])

  return (
    <div className="overflow-x-hidden bg-white dark:bg-[#0e0e0e]">
      {/* Hero Section */}
      <motion.section
        ref={setRefs}
        className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden py-20 w-full bg-white dark:bg-[#0e0e0e]"
        initial="hidden"
        animate={isHeroInView ? "visible" : "hidden"}
        variants={staggerContainer}
      >
        <motion.div
          className="absolute inset-0 -z-10"
          style={{ y }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-purple-900/20 dark:from-blue-900/30 dark:to-purple-900/30" />
          <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        </motion.div>

        <motion.h1
          className="text-4xl md:text-6xl lg:text-7xl font-bold text-center mb-6 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent w-full"
          variants={fadeIn}
        >
          Realtime Code Collaboration
        </motion.h1>

        <div className="max-w-4xl w-full mx-auto px-4">
        <motion.p
            className="text-xl md:text-2xl text-center max-w-3xl mb-10 text-gray-700 dark:text-gray-300 mx-auto"
          variants={fadeIn}
        >
          Code together in real-time with your team. Share, edit, and collaborate on code from anywhere in the world.
        </motion.p>

        <motion.div
            className="flex flex-col sm:flex-row gap-4 mb-16 justify-center"
          variants={fadeIn}
        >
          <motion.button
            onClick={() => router.push('/dashboard')}
            className="btn px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full text-lg font-medium flex items-center justify-center gap-2 group"
            whileHover={{ scale: 1.05, boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.5)" }}
            whileTap={{ scale: 0.95 }}
          >
            Get Started
            <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
          </motion.button>

          <motion.button
            onClick={() => router.push('/login')}
            className="btn px-8 py-3 bg-transparent border-2 border-blue-500 text-blue-500 dark:text-blue-400 rounded-full text-lg font-medium"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Login
          </motion.button>
        </motion.div>

        <motion.div
          className="w-full"
          variants={fadeIn}
        >
          <CodeBlock />
        </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <section className="py-20 w-full bg-gray-50 dark:bg-zinc-900">
        <div className="max-w-6xl w-full mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeIn}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful Features</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">Everything you need for seamless code collaboration</p>
          </motion.div>

          <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<FiCode />}
              title="Real-time Editing"
              description="See changes as they happen with real-time synchronization between all collaborators."
            />
            <FeatureCard
              icon={<FiUsers />}
              title="Team Collaboration"
              description="Invite team members to join your coding sessions with a simple link."
            />
            <FeatureCard
              icon={<FiLock />}
              title="Secure Connection"
              description="Your code is protected with end-to-end encryption and secure authentication."
            />
            <FeatureCard
              icon={<FiGlobe />}
              title="Cross-Platform"
              description="Work from any device with a browser - desktop, tablet, or mobile."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <motion.section
        className="py-20 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerContainer}
      >
        <div className="max-w-4xl w-full mx-auto px-4 text-center">
          <motion.h2
            className="text-3xl md:text-5xl font-bold mb-6"
            variants={fadeIn}
          >
            Ready to start collaborating?
          </motion.h2>
          <motion.p
            className="text-xl mb-8"
            variants={fadeIn}
          >
            Join thousands of developers who are already using RealCode for their team projects.
          </motion.p>
          <motion.button
            className="btn bg-blue-500 text-white px-8 py-3 rounded-full text-lg font-medium mx-auto"
            variants={fadeIn}
          >
            Sign Up For Free
            </motion.button>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="py-12 w-full bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100">
        <div className="max-w-6xl w-full mx-auto px-4">
          <div className="flex flex-col md:flex-row md:justify-center md:items-start gap-8 text-center md:text-left">
            <div className="flex-1 min-w-[180px]">
              <h3 className="text-xl font-bold mb-4 flex items-center justify-center md:justify-start">
                <FiCode className="mr-2" /> RealCode
              </h3>
              <p className="text-gray-500 dark:text-gray-400">Realtime collaborative coding platform for teams.</p>
            </div>

            <div className="flex-1 min-w-[180px]">
              <h4 className="text-lg font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><Link href="/features" className="text-gray-400 hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/docs" className="text-gray-400 hover:text-white transition-colors">Documentation</Link></li>
              </ul>
            </div>

            <div className="flex-1 min-w-[180px]">
              <h4 className="text-lg font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><Link href="/about" className="text-gray-400 hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="/blog" className="text-gray-400 hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/careers" className="text-gray-400 hover:text-white transition-colors">Careers</Link></li>
              </ul>
            </div>

            <div className="flex-1 min-w-[180px]">
              <h4 className="text-lg font-semibold mb-4">Connect</h4>
              <ul className="space-y-2">
                <li><Link href="/contact" className="text-gray-400 hover:text-white transition-colors">Contact Us</Link></li>
                <li><Link href="https://twitter.com" className="text-gray-400 hover:text-white transition-colors">Twitter</Link></li>
                <li><Link href="https://github.com" className="text-gray-400 hover:text-white transition-colors flex items-center"><FiGithub className="mr-2" /> GitHub</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800 text-center text-gray-500 dark:text-gray-400">
            <p>© {new Date().getFullYear()} RealCode. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}