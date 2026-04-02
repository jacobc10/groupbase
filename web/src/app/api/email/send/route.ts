import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendBulkEmails } from '@/lib/email'
import { checkEmailLimit } from '@/lib/plan-limits'

interface SendEmailRequest {
  member_ids: string[]
  subject: string
  body: string
  template_id?: string
}

interface Member {
  id: string
  name: string
  email: string | null
  group_id: string
}

interface ActivityLogEntry {
  action: string
  member_id: string
  group_id: string
  metadata: Record<string, unknown>
}

/**
 * POST /api/email/send
 * Send email to one or more members with template variable replacement
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: SendEmailRequest = await request.json()
    const { member_ids, subject, body: emailBody, template_id } = body

    // Validate input
    if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
      return NextResponse.json(
        { error: 'member_ids must be a non-empty array' },
        { status: 400 }
      )
    }

    if (!subject || typeof subject !== 'string') {
      return NextResponse.json(
        { error: 'subject is required and must be a string' },
        { status: 400 }
      )
    }

    if (!emailBody || typeof emailBody !== 'string') {
      return NextResponse.json(
        { error: 'body is required and must be a string' },
        { status: 400 }
      )
    }

    // Check email sending limits
    const emailLimits = await checkEmailLimit(user.id, member_ids.length)
    if (!emailLimits.allowed) {
      const reason = emailLimits.dailyLimit !== -1 && (emailLimits.dailyUsed + member_ids.length) > emailLimits.dailyLimit
        ? `Daily limit reached (${emailLimits.dailyUsed}/${emailLimits.dailyLimit} sent today)`
        : `Monthly limit reached (${emailLimits.monthlyUsed}/${emailLimits.monthlyLimit} sent this month)`
      return NextResponse.json(
        { error: `Email limit exceeded. ${reason}. Upgrade your plan for more.`, code: 'EMAIL_LIMIT_REACHED' },
        { status: 403 }
      )
    }

    // Fetch member data for all IDs
    const { data: members, error: fetchError } = await supabase
      .from('members')
      .select('id, name, email, group_id')
      .in('id', member_ids)

    if (fetchError) {
      console.error('Error fetching members:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch member data' },
        { status: 500 }
      )
    }

    if (!members || members.length === 0) {
      return NextResponse.json(
        { error: 'No members found with the provided IDs' },
        { status: 404 }
      )
    }

    // Get group info for template variables
    const groupIds = [...new Set((members as Member[]).map((m) => m.group_id))]
    const { data: groups, error: groupError } = await supabase
      .from('groups')
      .select('id, name')
      .in('id', groupIds)

    if (groupError) {
      console.error('Error fetching groups:', groupError)
    }

    const groupMap = new Map((groups || []).map((g: { id: string; name: string }) => [g.id, g.name]))

    // Prepare emails: replace template variables and skip members without email
    const emailsToSend = (members as Member[])
      .filter((member) => member.email && member.email.trim())
      .map((member) => {
        const groupName = groupMap.get(member.group_id) || 'your group'

        // Replace template variables
        let processedSubject = subject
          .replace(/\{\{name\}\}/g, member.name || '')
          .replace(/\{\{email\}\}/g, member.email || '')
          .replace(/\{\{group_name\}\}/g, groupName)

        let processedBody = emailBody
          .replace(/\{\{name\}\}/g, member.name || '')
          .replace(/\{\{email\}\}/g, member.email || '')
          .replace(/\{\{group_name\}\}/g, groupName)

        // Convert plain text to HTML (simple approach: wrap in <p> tags, replace line breaks)
        const htmlBody = processedBody
          .split('\n\n')
          .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
          .join('')

        return {
          to: member.email as string,
          subject: processedSubject,
          html: htmlBody,
          memberId: member.id,
          groupId: member.group_id,
        }
      })

    const skipped = (members as Member[]).length - emailsToSend.length

    // Send emails
    const sendResult = await sendBulkEmails(
      emailsToSend.map(({ to, subject: subj, html }) => ({
        to,
        subject: subj,
        html,
      }))
    )

    // Log activity for sent emails
    if (sendResult.sent > 0) {
      const sentEmails = emailsToSend.slice(0, sendResult.sent)
      const activityLogs: ActivityLogEntry[] = sentEmails.map(({ memberId, groupId }) => ({
        action: 'email_sent',
        member_id: memberId,
        group_id: groupId,
        metadata: {
          subject,
          template_id: template_id || null,
          timestamp: new Date().toISOString(),
        },
      }))

      const { error: logError } = await supabase.from('activity_log').insert(activityLogs)

      if (logError) {
        console.error('Error logging activity:', logError)
        // Don't fail the request if logging fails, but log the error
      }
    }

    return NextResponse.json({
      sent: sendResult.sent,
      skipped,
      failed: sendResult.failed,
      errors: sendResult.errors,
      success: sendResult.sent > 0,
    })
  } catch (error) {
    console.error('Email send error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to send emails: ${errorMessage}` },
      { status: 500 }
    )
  }
}
