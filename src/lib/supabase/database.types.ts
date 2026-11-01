
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_actions": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"id": number,"metadata": NonNullable<Json>,"reason": string | null,"target_id": string | null,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"reason"?: string | null,"target_id"?: string | null,"target_type": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"reason"?: string | null,"target_id"?: string | null,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_actions_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cart_items": {
                  Row: {
                    "added_at": string,"product_id": string,"quantity": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"product_id": string,"quantity": number,"user_id": string
                  }
                  Update: {
                    "added_at"?: string,"product_id"?: string,"quantity"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "store_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"description": string | null,"icon": string | null,"id": string,"is_active": boolean,"name": string,"parent_id": string | null,"slug": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"icon"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"parent_id"?: string | null,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"icon"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"parent_id"?: string | null,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"category_attributes": {
                  Row: {
                    "category_id": string,"created_at": string,"id": string,"is_filterable": boolean,"is_required": boolean,"key": string,"label": string,"options": NonNullable<Json>,"sort_order": number,"type": Database["public"]['Enums']["attribute_type"],"unit": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"created_at"?: string,"id"?: string,"is_filterable"?: boolean,"is_required"?: boolean,"key": string,"label": string,"options"?: NonNullable<Json>,"sort_order"?: number,"type"?: Database["public"]['Enums']["attribute_type"],"unit"?: string | null
                  }
                  Update: {
                    "category_id"?: string,"created_at"?: string,"id"?: string,"is_filterable"?: boolean,"is_required"?: boolean,"key"?: string,"label"?: string,"options"?: NonNullable<Json>,"sort_order"?: number,"type"?: Database["public"]['Enums']["attribute_type"],"unit"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "category_attributes_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "buyer_id": string,"buyer_last_read_at": string,"created_at": string,"id": string,"last_message_at": string,"last_message_preview": string | null,"listing_id": string,"seller_id": string,"seller_last_read_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_id": string,"buyer_last_read_at"?: string,"created_at"?: string,"id"?: string,"last_message_at"?: string,"last_message_preview"?: string | null,"listing_id": string,"seller_id": string,"seller_last_read_at"?: string | null
                  }
                  Update: {
                    "buyer_id"?: string,"buyer_last_read_at"?: string,"created_at"?: string,"id"?: string,"last_message_at"?: string,"last_message_preview"?: string | null,"listing_id"?: string,"seller_id"?: string,"seller_last_read_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string,"listing_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"listing_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"listing_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_attribute_values": {
                  Row: {
                    "attribute_id": string,"listing_id": string,"value_bool": boolean | null,"value_number": number | null,"value_text": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attribute_id": string,"listing_id": string,"value_bool"?: boolean | null,"value_number"?: number | null,"value_text"?: string | null
                  }
                  Update: {
                    "attribute_id"?: string,"listing_id"?: string,"value_bool"?: boolean | null,"value_number"?: number | null,"value_text"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_attribute_values_attribute_id_fkey"
      columns: ["attribute_id"]
isOneToOne: false
      referencedRelation: "category_attributes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_attribute_values_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_daily_stats": {
                  Row: {
                    "contacts": number,"day": string,"listing_id": string,"views": number
                  }
                  ComputedFields: never
                  Insert: {
                    "contacts"?: number,"day"?: string,"listing_id": string,"views"?: number
                  }
                  Update: {
                    "contacts"?: number,"day"?: string,"listing_id"?: string,"views"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_daily_stats_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_images": {
                  Row: {
                    "created_at": string,"height": number | null,"id": string,"listing_id": string,"sort_order": number,"storage_path": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"height"?: number | null,"id"?: string,"listing_id": string,"sort_order"?: number,"storage_path": string,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"height"?: number | null,"id"?: string,"listing_id"?: string,"sort_order"?: number,"storage_path"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_images_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    }
                  ]
                },"listings": {
                  Row: {
                    "approx_lat": number | null,"approx_lng": number | null,"category_id": string,"city": string | null,"condition": Database["public"]['Enums']["listing_condition"],"contact_count": number,"created_at": string,"currency": string,"description": string,"expires_at": string | null,"flagged_terms": (string)[],"id": string,"is_negotiable": boolean,"moderation_note": string | null,"price": number | null,"published_at": string | null,"quantity": number,"region_id": number | null,"search_vector": unknown,"seller_id": string,"slug": string,"sold_at": string | null,"sold_to_buyer_id": string | null,"status": Database["public"]['Enums']["listing_status"],"submitted_at": string | null,"title": string,"updated_at": string,"view_count": number,"listing_is_public": boolean | null
                  }
                  ComputedFields: "listing_is_public"
                  Insert: {
                    "approx_lat"?: number | null,"approx_lng"?: number | null,"category_id": string,"city"?: string | null,"condition"?: Database["public"]['Enums']["listing_condition"],"contact_count"?: number,"created_at"?: string,"currency"?: string,"description"?: string,"expires_at"?: string | null,"flagged_terms"?: (string)[],"id"?: string,"is_negotiable"?: boolean,"moderation_note"?: string | null,"price"?: number | null,"published_at"?: string | null,"quantity"?: number,"region_id"?: number | null,"search_vector"?: never,"seller_id": string,"slug"?: string,"sold_at"?: string | null,"sold_to_buyer_id"?: string | null,"status"?: Database["public"]['Enums']["listing_status"],"submitted_at"?: string | null,"title": string,"updated_at"?: string,"view_count"?: number
                  }
                  Update: {
                    "approx_lat"?: number | null,"approx_lng"?: number | null,"category_id"?: string,"city"?: string | null,"condition"?: Database["public"]['Enums']["listing_condition"],"contact_count"?: number,"created_at"?: string,"currency"?: string,"description"?: string,"expires_at"?: string | null,"flagged_terms"?: (string)[],"id"?: string,"is_negotiable"?: boolean,"moderation_note"?: string | null,"price"?: number | null,"published_at"?: string | null,"quantity"?: number,"region_id"?: number | null,"search_vector"?: never,"seller_id"?: string,"slug"?: string,"sold_at"?: string | null,"sold_to_buyer_id"?: string | null,"status"?: Database["public"]['Enums']["listing_status"],"submitted_at"?: string | null,"title"?: string,"updated_at"?: string,"view_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "listings_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_region_id_fkey"
      columns: ["region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_sold_to_buyer_id_fkey"
      columns: ["sold_to_buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string,"conversation_id": string,"created_at": string,"id": string,"kind": string,"sender_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"conversation_id": string,"created_at"?: string,"id"?: string,"kind"?: string,"sender_id"?: string | null
                  }
                  Update: {
                    "body"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"sender_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"link": string | null,"read_at": string | null,"reference_id": string | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"link"?: string | null,"read_at"?: string | null,"reference_id"?: string | null,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"link"?: string | null,"read_at"?: string | null,"reference_id"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"order_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"id": number,"note": string | null,"order_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: never,"note"?: string | null,"order_id": string,"status": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: never,"note"?: string | null,"order_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_events_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "id": string,"line_total": number | null,"order_id": string,"product_id": string | null,"product_name": string,"quantity": number,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"line_total"?: never,"order_id": string,"product_id"?: string | null,"product_name": string,"quantity": number,"unit_price": number
                  }
                  Update: {
                    "id"?: string,"line_total"?: never,"order_id"?: string,"product_id"?: string | null,"product_name"?: string,"quantity"?: number,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "store_products"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "created_at": string,"currency": string,"delivery_address": string | null,"delivery_city": string | null,"delivery_fee": number,"delivery_name": string | null,"delivery_notes": string | null,"delivery_phone": string | null,"delivery_region_id": number | null,"expires_at": string,"id": string,"kind": Database["public"]['Enums']["order_kind"],"order_number": string,"paid_at": string | null,"payment_status": Database["public"]['Enums']["payment_status"],"staff_note": string | null,"status": Database["public"]['Enums']["order_status"],"subtotal": number,"topup_attempts": number,"topup_bundle_id": string | null,"topup_bundle_name": string | null,"topup_last_error": string | null,"topup_network": Database["public"]['Enums']["mobile_network"] | null,"topup_provider_code": string | null,"topup_provider_reference": string | null,"topup_recipient": string | null,"topup_status": Database["public"]['Enums']["topup_status"] | null,"topup_type": string | null,"total": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: string,"delivery_address"?: string | null,"delivery_city"?: string | null,"delivery_fee"?: number,"delivery_name"?: string | null,"delivery_notes"?: string | null,"delivery_phone"?: string | null,"delivery_region_id"?: number | null,"expires_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["order_kind"],"order_number"?: string,"paid_at"?: string | null,"payment_status"?: Database["public"]['Enums']["payment_status"],"staff_note"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"subtotal": number,"topup_attempts"?: number,"topup_bundle_id"?: string | null,"topup_bundle_name"?: string | null,"topup_last_error"?: string | null,"topup_network"?: Database["public"]['Enums']["mobile_network"] | null,"topup_provider_code"?: string | null,"topup_provider_reference"?: string | null,"topup_recipient"?: string | null,"topup_status"?: Database["public"]['Enums']["topup_status"] | null,"topup_type"?: string | null,"total": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"delivery_address"?: string | null,"delivery_city"?: string | null,"delivery_fee"?: number,"delivery_name"?: string | null,"delivery_notes"?: string | null,"delivery_phone"?: string | null,"delivery_region_id"?: number | null,"expires_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["order_kind"],"order_number"?: string,"paid_at"?: string | null,"payment_status"?: Database["public"]['Enums']["payment_status"],"staff_note"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"subtotal"?: number,"topup_attempts"?: number,"topup_bundle_id"?: string | null,"topup_bundle_name"?: string | null,"topup_last_error"?: string | null,"topup_network"?: Database["public"]['Enums']["mobile_network"] | null,"topup_provider_code"?: string | null,"topup_provider_reference"?: string | null,"topup_recipient"?: string | null,"topup_status"?: Database["public"]['Enums']["topup_status"] | null,"topup_type"?: string | null,"total"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_delivery_region_id_fkey"
      columns: ["delivery_region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_topup_bundle_id_fkey"
      columns: ["topup_bundle_id"]
isOneToOne: false
      referencedRelation: "topup_bundles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_events": {
                  Row: {
                    "event_type": string,"id": number,"payload": NonNullable<Json>,"payment_id": string | null,"provider": string,"provider_event_id": string,"received_at": string,"status_after": Database["public"]['Enums']["payment_status"] | null,"status_before": Database["public"]['Enums']["payment_status"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "event_type": string,"id"?: never,"payload"?: NonNullable<Json>,"payment_id"?: string | null,"provider": string,"provider_event_id": string,"received_at"?: string,"status_after"?: Database["public"]['Enums']["payment_status"] | null,"status_before"?: Database["public"]['Enums']["payment_status"] | null
                  }
                  Update: {
                    "event_type"?: string,"id"?: never,"payload"?: NonNullable<Json>,"payment_id"?: string | null,"provider"?: string,"provider_event_id"?: string,"received_at"?: string,"status_after"?: Database["public"]['Enums']["payment_status"] | null,"status_before"?: Database["public"]['Enums']["payment_status"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_events_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"channel": string | null,"checkout_id": string | null,"created_at": string,"currency": string,"id": string,"order_id": string | null,"promotion_id": string | null,"provider": string,"provider_transaction_id": string | null,"purpose": string,"reference": string,"status": Database["public"]['Enums']["payment_status"],"updated_at": string,"user_id": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"channel"?: string | null,"checkout_id"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"order_id"?: string | null,"promotion_id"?: string | null,"provider": string,"provider_transaction_id"?: string | null,"purpose": string,"reference": string,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"user_id": string,"verified_at"?: string | null
                  }
                  Update: {
                    "amount"?: number,"channel"?: string | null,"checkout_id"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"order_id"?: string | null,"promotion_id"?: string | null,"provider"?: string,"provider_transaction_id"?: string | null,"purpose"?: string,"reference"?: string,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"user_id"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_promotion_id_fkey"
      columns: ["promotion_id"]
isOneToOne: false
      referencedRelation: "promotions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_settings": {
                  Row: {
                    "description": string | null,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_contacts": {
                  Row: {
                    "email_notifications": boolean,"phone": string | null,"show_phone": boolean,"updated_at": string,"user_id": string,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "email_notifications"?: boolean,"phone"?: string | null,"show_phone"?: boolean,"updated_at"?: string,"user_id": string,"whatsapp"?: string | null
                  }
                  Update: {
                    "email_notifications"?: boolean,"phone"?: string | null,"show_phone"?: boolean,"updated_at"?: string,"user_id"?: string,"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_contacts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"bio": string | null,"city": string | null,"created_at": string,"deletion_requested_at": string | null,"display_name": string,"id": string,"is_verified": boolean,"region_id": number | null,"role": Database["public"]['Enums']["user_role"],"status": Database["public"]['Enums']["account_status"],"suspended_reason": string | null,"updated_at": string,"username": string | null,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"bio"?: string | null,"city"?: string | null,"created_at"?: string,"deletion_requested_at"?: string | null,"display_name": string,"id": string,"is_verified"?: boolean,"region_id"?: number | null,"role"?: Database["public"]['Enums']["user_role"],"status"?: Database["public"]['Enums']["account_status"],"suspended_reason"?: string | null,"updated_at"?: string,"username"?: string | null,"verified_at"?: string | null
                  }
                  Update: {
                    "avatar_path"?: string | null,"bio"?: string | null,"city"?: string | null,"created_at"?: string,"deletion_requested_at"?: string | null,"display_name"?: string,"id"?: string,"is_verified"?: boolean,"region_id"?: number | null,"role"?: Database["public"]['Enums']["user_role"],"status"?: Database["public"]['Enums']["account_status"],"suspended_reason"?: string | null,"updated_at"?: string,"username"?: string | null,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_region_fk"
      columns: ["region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    }
                  ]
                },"promotion_plans": {
                  Row: {
                    "created_at": string,"currency": string,"description": string | null,"duration_days": number,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["promotion_kind"],"name": string,"price": number,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: string,"description"?: string | null,"duration_days": number,"id"?: string,"is_active"?: boolean,"kind": Database["public"]['Enums']["promotion_kind"],"name": string,"price": number,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"description"?: string | null,"duration_days"?: number,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["promotion_kind"],"name"?: string,"price"?: number,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"promotions": {
                  Row: {
                    "amount": number,"created_at": string,"currency": string,"duration_days": number,"ends_at": string | null,"id": string,"kind": Database["public"]['Enums']["promotion_kind"],"listing_id": string,"payment_status": Database["public"]['Enums']["payment_status"],"plan_id": string | null,"seller_id": string,"starts_at": string | null,"status": Database["public"]['Enums']["promotion_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"currency"?: string,"duration_days": number,"ends_at"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["promotion_kind"],"listing_id": string,"payment_status"?: Database["public"]['Enums']["payment_status"],"plan_id"?: string | null,"seller_id": string,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["promotion_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"currency"?: string,"duration_days"?: number,"ends_at"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["promotion_kind"],"listing_id"?: string,"payment_status"?: Database["public"]['Enums']["payment_status"],"plan_id"?: string | null,"seller_id"?: string,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["promotion_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "promotions_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "promotion_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotions_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"regions": {
                  Row: {
                    "capital": string,"id": number,"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "capital": string,"id": number,"name": string,"slug": string
                  }
                  Update: {
                    "capital"?: string,"id"?: number,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"details": string | null,"id": string,"listing_id": string | null,"message_id": string | null,"reason": Database["public"]['Enums']["report_reason"],"reported_user_id": string | null,"reporter_id": string,"resolution_note": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["report_status"],"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"listing_id"?: string | null,"message_id"?: string | null,"reason": Database["public"]['Enums']["report_reason"],"reported_user_id"?: string | null,"reporter_id": string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_type": string
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"listing_id"?: string | null,"message_id"?: string | null,"reason"?: Database["public"]['Enums']["report_reason"],"reported_user_id"?: string | null,"reporter_id"?: string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reported_user_id_fkey"
      columns: ["reported_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "comment": string | null,"created_at": string,"id": string,"is_hidden": boolean,"listing_id": string,"rating": number,"reviewer_id": string,"seller_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"created_at"?: string,"id"?: string,"is_hidden"?: boolean,"listing_id": string,"rating": number,"reviewer_id": string,"seller_id": string
                  }
                  Update: {
                    "comment"?: string | null,"created_at"?: string,"id"?: string,"is_hidden"?: boolean,"listing_id"?: string,"rating"?: number,"reviewer_id"?: string,"seller_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"store_product_images": {
                  Row: {
                    "created_at": string,"id": string,"product_id": string,"sort_order": number,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"product_id": string,"sort_order"?: number,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"product_id"?: string,"sort_order"?: number,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "store_product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "store_products"
      referencedColumns: ["id"]
    }
                  ]
                },"store_products": {
                  Row: {
                    "brand": string | null,"category_id": string | null,"compare_at_price": number | null,"created_at": string,"description": string,"id": string,"is_active": boolean,"is_featured": boolean,"name": string,"price": number,"search_vector": unknown,"sku": string | null,"slug": string,"stock": number,"updated_at": string,"warranty": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "brand"?: string | null,"category_id"?: string | null,"compare_at_price"?: number | null,"created_at"?: string,"description"?: string,"id"?: string,"is_active"?: boolean,"is_featured"?: boolean,"name": string,"price": number,"search_vector"?: never,"sku"?: string | null,"slug"?: string,"stock"?: number,"updated_at"?: string,"warranty"?: string | null
                  }
                  Update: {
                    "brand"?: string | null,"category_id"?: string | null,"compare_at_price"?: number | null,"created_at"?: string,"description"?: string,"id"?: string,"is_active"?: boolean,"is_featured"?: boolean,"name"?: string,"price"?: number,"search_vector"?: never,"sku"?: string | null,"slug"?: string,"stock"?: number,"updated_at"?: string,"warranty"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "store_products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"topup_bundles": {
                  Row: {
                    "created_at": string,"data_mb": number | null,"id": string,"is_active": boolean,"name": string,"network": Database["public"]['Enums']["mobile_network"],"price": number,"provider_code": string,"sort_order": number,"validity": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"data_mb"?: number | null,"id"?: string,"is_active"?: boolean,"name": string,"network": Database["public"]['Enums']["mobile_network"],"price": number,"provider_code": string,"sort_order"?: number,"validity"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"data_mb"?: number | null,"id"?: string,"is_active"?: boolean,"name"?: string,"network"?: Database["public"]['Enums']["mobile_network"],"price"?: number,"provider_code"?: string,"sort_order"?: number,"validity"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"user_blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "activate_promotion_internal":
{ Args: { "p_payment": Database["public"]['Enums']["payment_status"],"p_promotion": string }; Returns: undefined
                           },
"admin_activate_promotion_test":
{ Args: { "p_promotion": string,"p_reason": string }; Returns: undefined
                           },
"admin_cancel_promotion":
{ Args: { "p_promotion": string,"p_reason": string }; Returns: undefined
                           },
"admin_dashboard_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_list_users":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_query"?: string,"p_role"?: Database["public"]['Enums']["user_role"],"p_status"?: Database["public"]['Enums']["account_status"] }; Returns: {
              "created_at": string,"deletion_requested_at": string,"display_name": string,"email": string,"id": string,"is_verified": boolean,"last_sign_in_at": string,"listing_count": number,"open_reports": number,"role": Database["public"]['Enums']["user_role"],"status": Database["public"]['Enums']["account_status"],"suspended_reason": string,"total_count": number,"username": string
            }[]
                           },
"admin_moderate_listing":
{ Args: { "p_action": string,"p_listing": string,"p_reason": string }; Returns: undefined
                           },
"admin_reported_message":
{ Args: { "p_report": string }; Returns: {
              "body": string,"created_at": string,"sender_id": string
            }[]
                           },
"admin_retry_topup":
{ Args: { "p_note": string,"p_order": string }; Returns: undefined
                           },
"admin_set_review_hidden":
{ Args: { "p_hidden": boolean,"p_reason": string,"p_review": string }; Returns: undefined
                           },
"admin_set_user_role":
{ Args: { "p_reason": string,"p_role": Database["public"]['Enums']["user_role"],"p_user": string }; Returns: undefined
                           },
"admin_set_user_status":
{ Args: { "p_reason": string,"p_status": Database["public"]['Enums']["account_status"],"p_user": string }; Returns: undefined
                           },
"admin_set_verified":
{ Args: { "p_reason": string,"p_user": string,"p_verified": boolean }; Returns: undefined
                           },
"admin_update_order":
{ Args: { "p_note": string,"p_order": string,"p_status": Database["public"]['Enums']["order_status"] }; Returns: undefined
                           },
"admin_update_report":
{ Args: { "p_note": string,"p_report": string,"p_status": Database["public"]['Enums']["report_status"] }; Returns: undefined
                           },
"become_seller":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"can_sell":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"cancel_my_order":
{ Args: { "p_order": string }; Returns: undefined
                           },
"cancel_promotion":
{ Args: { "p_promotion": string }; Returns: undefined
                           },
"category_ancestors":
{ Args: { "p_category": string }; Returns: string[]
                           },
"category_descendants":
{ Args: { "p_category": string }; Returns: string[]
                           },
"confirm_order_payment":
{ Args: { "p_amount": number,"p_order": string,"p_payment_status": Database["public"]['Enums']["payment_status"] }; Returns: {
              "created_at": string,
"currency": string,
"delivery_address": string | null,
"delivery_city": string | null,
"delivery_fee": number,
"delivery_name": string | null,
"delivery_notes": string | null,
"delivery_phone": string | null,
"delivery_region_id": number | null,
"expires_at": string,
"id": string,
"kind": Database["public"]['Enums']["order_kind"],
"order_number": string,
"paid_at": string | null,
"payment_status": Database["public"]['Enums']["payment_status"],
"staff_note": string | null,
"status": Database["public"]['Enums']["order_status"],
"subtotal": number,
"topup_attempts": number,
"topup_bundle_id": string | null,
"topup_bundle_name": string | null,
"topup_last_error": string | null,
"topup_network": Database["public"]['Enums']["mobile_network"] | null,
"topup_provider_code": string | null,
"topup_provider_reference": string | null,
"topup_recipient": string | null,
"topup_status": Database["public"]['Enums']["topup_status"] | null,
"topup_type": string | null,
"total": number,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"delivery_fee_for":
{ Args: { "p_region": number,"p_subtotal": number }; Returns: number
                           },
"expire_listings":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"expire_promotions":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"expire_unpaid_orders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"find_prohibited_terms":
{ Args: { "p_text": string }; Returns: (string)[]
                           },
"is_active_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_blocked_between":
{ Args: { "a": string,"b": string }; Returns: boolean
                           },
"is_client_call":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_conversation_participant":
{ Args: { "p_conversation": string }; Returns: boolean
                           },
"listing_is_public":
{ Args: { "l": Omit<Database["public"]['Tables']["listings"]['Row'], Database["public"]['Tables']["listings"]['ComputedFields']> }; Returns: boolean
                           },
"listing_promoted":
{ Args: { "p_kind": Database["public"]['Enums']["promotion_kind"],"p_listing": string }; Returns: boolean
                           },
"log_admin_action":
{ Args: { "p_action": string,"p_meta"?: Json,"p_reason": string,"p_target_id": string,"p_target_type": string }; Returns: undefined
                           },
"log_order_event":
{ Args: { "p_note"?: string,"p_order": string,"p_status": string }; Returns: undefined
                           },
"mark_conversation_read":
{ Args: { "p_conversation": string }; Returns: undefined
                           },
"notify":
{ Args: { "p_body": string,"p_link": string,"p_ref"?: string,"p_title": string,"p_type": string,"p_user": string }; Returns: undefined
                           },
"place_goods_order":
{ Args: { "p_address": string,"p_city": string,"p_name": string,"p_notes": string,"p_phone": string,"p_region": number }; Returns: string
                           },
"place_topup_order":
{ Args: { "p_amount": number,"p_bundle"?: string,"p_network": Database["public"]['Enums']["mobile_network"],"p_recipient": string,"p_type": string }; Returns: string
                           },
"record_listing_event":
{ Args: { "p_kind": string,"p_listing": string }; Returns: undefined
                           },
"record_payment_failure":
{ Args: { "p_order": string,"p_reason": string }; Returns: undefined
                           },
"record_topup_result":
{ Args: { "p_delivered": boolean,"p_error"?: string,"p_order": string,"p_provider_reference"?: string }; Returns: undefined
                           },
"renew_listing":
{ Args: { "p_listing": string }; Returns: undefined
                           },
"request_promotion":
{ Args: { "p_listing": string,"p_plan": string }; Returns: string
                           },
"require_admin":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"search_listings":
{ Args: { "p_attrs"?: Json,"p_category"?: string,"p_condition"?: Database["public"]['Enums']["listing_condition"],"p_featured_only"?: boolean,"p_limit"?: number,"p_max_price"?: number,"p_min_price"?: number,"p_offset"?: number,"p_query"?: string,"p_region"?: number,"p_sort"?: string }; Returns: {
              "city": string,"condition": Database["public"]['Enums']["listing_condition"],"cover_path": string,"currency": string,"id": string,"is_boosted": boolean,"is_featured": boolean,"is_negotiable": boolean,"price": number,"published_at": string,"region_name": string,"seller_id": string,"seller_verified": boolean,"slug": string,"status": Database["public"]['Enums']["listing_status"],"title": string,"total_count": number
            }[]
                           },
"search_suggestions":
{ Args: { "p_query": string }; Returns: {
              "kind": string,"label": string,"slug": string
            }[]
                           },
"seller_rating":
{ Args: { "p_seller": string }; Returns: {
              "average": number,"total": number
            }[]
                           },
"seller_shares_phone":
{ Args: { "p_seller": string }; Returns: boolean
                           },
"seller_transition_allowed":
{ Args: { "p_from": Database["public"]['Enums']["listing_status"],"p_to": Database["public"]['Enums']["listing_status"] }; Returns: boolean
                           },
"setting":
{ Args: { "p_key": string }; Returns: Json
                           },
"slugify":
{ Args: { "input": string }; Returns: string
                           },
"start_conversation":
{ Args: { "p_listing": string }; Returns: string
                           },
"trust":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"unread_conversation_count":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"untrust":
{ Args: { "p_previous"?: string }; Returns: undefined
                           }
          }
          Enums: {
            "account_status": "active"|"suspended","attribute_type": "text"|"number"|"select"|"boolean","listing_condition": "new"|"used"|"refurbished"|"not_applicable","listing_status": "draft"|"pending_review"|"published"|"paused"|"sold"|"rejected"|"expired"|"removed","mobile_network": "mtn"|"telecel"|"airteltigo","order_kind": "goods"|"topup","order_status": "pending_payment"|"paid"|"processing"|"shipped"|"delivered"|"cancelled"|"failed"|"refund_due"|"refunded","payment_status": "unpaid"|"pending"|"paid"|"failed"|"refunded"|"test","promotion_kind": "featured"|"boost","promotion_status": "pending_payment"|"active"|"expired"|"cancelled","report_reason": "scam"|"fake_or_misleading"|"prohibited_item"|"spam"|"harassment"|"impersonation"|"other","report_status": "open"|"reviewing"|"resolved"|"dismissed","topup_status": "waiting_payment"|"sending"|"delivered"|"failed","user_role": "buyer"|"seller"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "account_status": ["active", "suspended"],"attribute_type": ["text", "number", "select", "boolean"],"listing_condition": ["new", "used", "refurbished", "not_applicable"],"listing_status": ["draft", "pending_review", "published", "paused", "sold", "rejected", "expired", "removed"],"mobile_network": ["mtn", "telecel", "airteltigo"],"order_kind": ["goods", "topup"],"order_status": ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "failed", "refund_due", "refunded"],"payment_status": ["unpaid", "pending", "paid", "failed", "refunded", "test"],"promotion_kind": ["featured", "boost"],"promotion_status": ["pending_payment", "active", "expired", "cancelled"],"report_reason": ["scam", "fake_or_misleading", "prohibited_item", "spam", "harassment", "impersonation", "other"],"report_status": ["open", "reviewing", "resolved", "dismissed"],"topup_status": ["waiting_payment", "sending", "delivered", "failed"],"user_role": ["buyer", "seller", "admin"]
          }
        }
} as const
