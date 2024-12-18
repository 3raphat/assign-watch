import { useCallback, useEffect, useMemo, useState, type FC } from "react"
import isPropValid from "@emotion/is-prop-valid"
import { useQueries } from "@tanstack/react-query"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import { EyeOff, LayoutGrid, LayoutList } from "lucide-react"
import { StyleSheetManager, ThemeProvider } from "styled-components"
import { storage } from "wxt/storage"

import {
  AssignmentContainer,
  AssignmentInfo,
  AssignmentItem,
} from "@/entrypoints/content/components/styled/Assignment"
import { StatusBadge } from "@/entrypoints/content/components/styled/Badges"
import {
  ThemeToggleButton,
  ViewToggleButton,
} from "@/entrypoints/content/components/styled/Button"
import {
  ClassCard,
  ClassContainer,
} from "@/entrypoints/content/components/styled/Class"
import {
  DropdownButton,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  TabButton,
  TabContainer,
} from "@/entrypoints/content/components/styled/Dropdown"
import {
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from "@/entrypoints/content/components/styled/Modal"
import {
  DueDate,
  NoAssignments,
} from "@/entrypoints/content/components/styled/Typography"
import { darkTheme, lightTheme } from "@/entrypoints/content/components/themes"
import type { AssignmentResponse } from "@/types"

import "dayjs/locale/th"

dayjs.extend(relativeTime)
dayjs.locale("th")

const App: FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isGridView, setIsGridView] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [hiddenClasses, setHiddenClasses] = useState<string[]>([])
  const [hiddenAssignments, setHiddenAssignments] = useState<string[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(dayjs())
  const [activeTab, setActiveTab] = useState<"classes" | "assignments">(
    "classes"
  )

  const allClassInfo = useMemo(() => getAllClassInfo(), [])

  useEffect(() => {
    const loadPreferences = async () => {
      const [
        savedView,
        savedDarkMode,
        savedHiddenClasses,
        savedHiddenAssignments,
      ] = await Promise.all([
        storage.getItem<boolean>("local:assignmentsGridView"),
        storage.getItem<boolean>("local:darkMode"),
        storage.getItem<string[]>("local:hiddenClasses"),
        storage.getItem<string[]>("local:hiddenAssignments"),
      ])

      setIsGridView(savedView ?? false)
      setIsDarkMode(savedDarkMode ?? false)
      setHiddenClasses(savedHiddenClasses ?? [])
      setHiddenAssignments(savedHiddenAssignments ?? [])
    }
    loadPreferences()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdownContainers = document.querySelectorAll(
        ".dropdown-container"
      )
      let clickedInside = false

      dropdownContainers.forEach((container) => {
        if (container && container.contains(event.target as Node)) {
          clickedInside = true
        }
      })

      if (!clickedInside) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }

    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  const handleViewChange = useCallback(async (checked: boolean) => {
    setIsGridView(checked)
    await storage.setItem<boolean>("local:assignmentsGridView", checked)
  }, [])

  const toggleDarkMode = useCallback(async () => {
    setIsDarkMode((prev) => {
      const newValue = !prev
      storage.setItem<boolean>("local:darkMode", newValue)
      return newValue
    })
  }, [])

  const handleClassVisibilityChange = useCallback(
    async (classId: string, isChecked: boolean) => {
      setHiddenClasses((prev) => {
        const newHiddenClasses = isChecked
          ? prev.filter((id) => id !== classId)
          : [...prev, classId]
        storage.setItem<string[]>("local:hiddenClasses", newHiddenClasses)
        return newHiddenClasses
      })
    },
    []
  )

  const handleAssignmentVisibilityChange = useCallback(
    async (assignmentId: string, isChecked: boolean) => {
      setHiddenAssignments((prev) => {
        const newHiddenAssignments = isChecked
          ? prev.filter((id) => id !== assignmentId)
          : [...prev, assignmentId]
        storage.setItem<string[]>(
          "local:hiddenAssignments",
          newHiddenAssignments
        )
        return newHiddenAssignments
      })
    },
    []
  )

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setIsOpen(false)
      setIsClosing(false)
    }, 200)
  }, [])

  const assignments = useQueries({
    queries: allClassInfo.map((classInfo) => ({
      queryKey: ["classInfo", classInfo.id],
      queryFn: () => getAssignmentsEachClass(classInfo.id),
      staleTime: 30000, // Cache results for 30 seconds
      cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    })),
  })

  const classWithAssignments = useMemo(
    () =>
      allClassInfo.map((classInfo, index) => ({
        ...classInfo,
        assignments: assignments[index]?.data as AssignmentResponse,
      })),
    [allClassInfo, assignments]
  )

  useEffect(() => {
    const saveClassWithAssignments = async () => {
      await storage.setItem(
        "local:classWithAssignments",
        classWithAssignments.map((classInfo) => ({
          ...classInfo,
          assignments: {
            ...classInfo.assignments,
            activities: classInfo.assignments?.activities.filter(
              (activity) =>
                activity.due_date && new Date(activity.due_date) > new Date()
            ),
          },
        }))
      )
    }
    saveClassWithAssignments()
  }, [classWithAssignments])

  const handleOpenModal = useCallback(() => {
    const currentUrl = window.location.href
    if (
      currentUrl !== "https://app.leb2.org/class" &&
      currentUrl.match(/^https:\/\/app\.leb2\.org\/class\/.+/)
    ) {
      window.location.href = "https://app.leb2.org/class?openModal=true"
    } else {
      setIsOpen(true)
    }
  }, [])

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get("openModal") === "true") {
      setIsOpen(true)
      const newUrl = window.location.origin + window.location.pathname
      window.history.replaceState({}, "", newUrl)
    }
  }, [])

  const formatDueDate = useCallback(
    (dueDate: string | null) => {
      if (!dueDate) return ""

      const due = dayjs(dueDate)
      const diffDays = due.diff(currentTime, "day")
      const diffHours = due.diff(currentTime, "hour")
      const diffMinutes = due.diff(currentTime, "minute")
      const diffSeconds = due.diff(currentTime, "second")

      const formatWithColor = (text: string, color: string) => (
        <span style={{ color }}>{text}</span>
      )

      if (diffSeconds < 0) {
        return formatWithColor("เลยกำหนดส่ง", "#ef4444")
      }

      if (diffHours < 1) {
        return formatWithColor(`~${diffMinutes} นาที`, "#f97316")
      }

      if (diffHours < 24) {
        const remainingHours = diffHours
        const remainingMinutes = diffMinutes % 60
        const text =
          remainingMinutes > 0
            ? `~${remainingHours} ชั่วโมง ${remainingMinutes} นาที`
            : `~${remainingHours} ชั่วโมง`
        return formatWithColor(text, "#eab308")
      }

      const remainingDays = diffDays
      const remainingHours = diffHours % 24
      const text =
        remainingHours > 0
          ? `~${remainingDays} วัน ${remainingHours} ชั่วโมง`
          : `~${remainingDays} วัน`
      return formatWithColor(text, "#22c55e")
    },
    [currentTime]
  )

  const theme = useMemo(
    () => (isDarkMode ? darkTheme : lightTheme),
    [isDarkMode]
  )

  useEffect(() => {
    const handleKeyboardShortcut = () => {
      if (isOpen) {
        handleClose()
      } else {
        handleOpenModal()
      }
    }

    document.addEventListener("openAssignmentModal", handleKeyboardShortcut)

    return () => {
      document.removeEventListener(
        "openAssignmentModal",
        handleKeyboardShortcut
      )
    }
  }, [handleOpenModal, handleClose, isOpen])

  return (
    <StyleSheetManager shouldForwardProp={isPropValid}>
      <ThemeProvider theme={theme}>
        <div className="nav-item">
          <button
            type="button"
            className="nav-link header-link"
            style={{
              outline: "none",
              border: "none",
              background: "none",
            }}
            onClick={handleOpenModal}
          >
            Assignments ✨
          </button>

          {isOpen && (
            <>
              <ModalOverlay
                onClick={handleClose}
                className={isClosing ? "closing" : ""}
              />
              <ModalContent
                $isGrid={isGridView}
                className={isClosing ? "closing" : ""}
              >
                <ModalHeader>
                  <div
                    className="dropdown-container"
                    style={{ position: "relative" }}
                  >
                    <DropdownButton
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                      Show / Hide
                    </DropdownButton>
                    {isDropdownOpen && (
                      <DropdownContent>
                        <TabContainer>
                          <TabButton
                            active={activeTab === "classes"}
                            onClick={() => setActiveTab("classes")}
                          >
                            Classes
                          </TabButton>
                          <TabButton
                            active={activeTab === "assignments"}
                            onClick={() => setActiveTab("assignments")}
                          >
                            Assignments
                          </TabButton>
                        </TabContainer>

                        {activeTab === "classes" ? (
                          allClassInfo.map((classInfo) => (
                            <DropdownItem key={classInfo.id}>
                              <input
                                type="checkbox"
                                checked={!hiddenClasses.includes(classInfo.id)}
                                onChange={(e) =>
                                  handleClassVisibilityChange(
                                    classInfo.id,
                                    e.target.checked
                                  )
                                }
                                style={{ marginRight: "8px" }}
                              />
                              {classInfo.title}
                            </DropdownItem>
                          ))
                        ) : (
                          <>
                            {classWithAssignments.map((classInfo) => {
                              const hiddenClassAssignments =
                                classInfo.assignments?.activities.filter(
                                  (assignment) =>
                                    hiddenAssignments.includes(
                                      assignment.id.toString()
                                    )
                                )

                              if (!hiddenClassAssignments?.length) return null

                              return (
                                <div key={classInfo.id}>
                                  <DropdownLabel>
                                    {classInfo.title}
                                  </DropdownLabel>
                                  {hiddenClassAssignments.map((assignment) => (
                                    <DropdownItem key={assignment.id}>
                                      <input
                                        type="checkbox"
                                        checked={false}
                                        onChange={() =>
                                          handleAssignmentVisibilityChange(
                                            assignment.id.toString(),
                                            true
                                          )
                                        }
                                        style={{ marginRight: "8px" }}
                                      />
                                      {assignment.title}
                                    </DropdownItem>
                                  ))}
                                </div>
                              )
                            })}
                            {classWithAssignments.every(
                              (classInfo) =>
                                !classInfo.assignments?.activities.some(
                                  (assignment) =>
                                    hiddenAssignments.includes(
                                      assignment.id.toString()
                                    )
                                )
                            ) && (
                              <p
                                style={{
                                  padding: "0.5rem 0.75rem",
                                }}
                              >
                                No hidden assignments
                              </p>
                            )}
                          </>
                        )}
                      </DropdownContent>
                    )}
                  </div>
                  <h1>Assignments 🥰</h1>
                  <div className="settings-bar">
                    <ThemeToggleButton onClick={toggleDarkMode}>
                      {isDarkMode ? "🌞" : "🌚"}
                    </ThemeToggleButton>
                    <div className="view-toggle">
                      <ViewToggleButton
                        active={!isGridView}
                        onClick={() => handleViewChange(false)}
                      >
                        <LayoutList size={16} />
                      </ViewToggleButton>
                      <ViewToggleButton
                        active={isGridView}
                        onClick={() => handleViewChange(true)}
                      >
                        <LayoutGrid size={16} />
                      </ViewToggleButton>
                    </div>
                  </div>
                </ModalHeader>
                <ClassContainer $isGrid={isGridView}>
                  {classWithAssignments.map((classInfo) => {
                    const isHidden = hiddenClasses.includes(classInfo.id)
                    if (isHidden) return null

                    const { activities } = classInfo.assignments || {
                      activities: [],
                    }

                    const assignmentsToSubmit = activities.filter(
                      (assignment) => assignment.due_date !== null
                    )
                    const submittedAssignments = activities.filter(
                      (assignment) =>
                        assignment.quiz_submission_is_submitted === 1
                    )
                    const lateAssignments = assignmentsToSubmit.filter(
                      (assignment) => assignment.due_date_exceed
                    )
                    const filteredAssignments = assignmentsToSubmit.filter(
                      (assignment) =>
                        (!lateAssignments.includes(assignment) ||
                          !submittedAssignments.includes(assignment)) &&
                        !hiddenAssignments.includes(assignment.id.toString())
                    )

                    return (
                      <ClassCard key={classInfo.id}>
                        <div className="class-card-header">
                          <h2>
                            <a
                              href={`https://app.leb2.org/class/${classInfo.id}/checkAfterAccessClass`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {classInfo.title}
                            </a>
                          </h2>
                          <p>{classInfo.description}</p>
                        </div>
                        <AssignmentContainer>
                          {filteredAssignments.length > 0 ? (
                            filteredAssignments.map((assignment) => (
                              <AssignmentItem
                                key={assignment.id}
                                onMouseOver={() => {
                                  const hideButton = document.querySelector(
                                    `#hide-button-${assignment.id}`
                                  ) as HTMLButtonElement
                                  hideButton.style.opacity = "1"
                                }}
                                onMouseOut={() => {
                                  const hideButton = document.querySelector(
                                    `#hide-button-${assignment.id}`
                                  ) as HTMLButtonElement
                                  hideButton.style.opacity = "0"
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "start",
                                  }}
                                >
                                  <AssignmentInfo>
                                    <a
                                      href={`https://app.leb2.org/class/${
                                        classInfo.id
                                      }/${
                                        assignment.type === "ASM"
                                          ? "activity"
                                          : "quiz"
                                      }/${assignment.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="assignment-link"
                                    >
                                      <span>{assignment.title}</span>
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
                                        />
                                      </svg>
                                    </a>
                                    <DueDate>
                                      กำหนดส่ง:{" "}
                                      {dayjs(assignment.due_date).format(
                                        "D MMM YYYY HH:mm"
                                      )}
                                      {" | "}
                                      {formatDueDate(assignment.due_date)}
                                    </DueDate>
                                  </AssignmentInfo>
                                  <button
                                    type="button"
                                    id={`hide-button-${assignment.id}`}
                                    className="btn"
                                    style={{
                                      opacity: 0,
                                      height: "32px",
                                      width: "32px",
                                      padding: "4px",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      borderRadius: "8px",
                                      transition: "opacity 0.1s ease-in",
                                    }}
                                    onClick={() =>
                                      handleAssignmentVisibilityChange(
                                        assignment.id.toString(),
                                        false
                                      )
                                    }
                                  >
                                    <EyeOff size={16} />
                                  </button>
                                </div>
                                <div className="status-badges">
                                  <StatusBadge
                                    $type={
                                      assignment.quiz_submission_is_submitted ===
                                      1
                                        ? "submitted"
                                        : "notSubmitted"
                                    }
                                  >
                                    {assignment.quiz_submission_is_submitted ===
                                    1
                                      ? "ส่งแล้ว"
                                      : "ยังไม่ส่ง"}
                                  </StatusBadge>
                                  <StatusBadge $type={assignment.type}>
                                    {assignment.type === "ASM"
                                      ? "Assignment"
                                      : "Quiz"}
                                  </StatusBadge>
                                  <StatusBadge $type={assignment.group_type}>
                                    {assignment.group_type === "IND"
                                      ? "งานเดี่ยว"
                                      : "งานกลุ่ม"}
                                  </StatusBadge>
                                </div>
                              </AssignmentItem>
                            ))
                          ) : (
                            <NoAssignments>ไม่มีงานที่รอส่ง</NoAssignments>
                          )}
                        </AssignmentContainer>
                      </ClassCard>
                    )
                  })}
                </ClassContainer>
              </ModalContent>
            </>
          )}
        </div>
      </ThemeProvider>
    </StyleSheetManager>
  )
}

export default App
